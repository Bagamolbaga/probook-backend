import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, UpdateQuery } from 'mongoose';
import { Service } from './schema/services.schema';
import { Specialist } from '../specialists/schema/specialists.schema';
import { ServiceCategory } from '../service-categories/schema/service-category.schema';
import {
  CreateServiceDto,
  SpecialistReference,
  UpdateServiceDto,
} from './dto/service.dto';

type CreateServiceInput = CreateServiceDto & {
  companyId: string;
};

@Injectable()
export class ServiceService {
  constructor(
    @InjectModel(Service.name) private serviceModel: Model<Service>,
    @InjectModel(Specialist.name)
    private specialistModel: Model<Specialist>,
    @InjectModel(ServiceCategory.name)
    private categoryModel: Model<ServiceCategory>,
  ) {}

  async createService(dto: CreateServiceInput) {
    const {
      companyId,
      categoryId,
      specialistIds,
      specialists,
      ...serviceData
    } = dto;
    const category = await this.getAvailableCategory(categoryId, companyId);
    const normalizedSpecialistIds = this.normalizeObjectIds(
      specialistIds ?? specialists,
    );
    const newUser = new this.serviceModel({
      ...serviceData,
      company: new Types.ObjectId(companyId),
      category: category._id,
      specialists: normalizedSpecialistIds,
    });
    const service = await newUser.save();

    await this.syncSpecialistsForService({
      serviceId: service._id,
      companyId,
      previousSpecialistIds: [],
      nextSpecialistIds: normalizedSpecialistIds,
    });

    return service;
  }

  async getCompanyServices({ companyId }: { companyId: string }) {
    return this.serviceModel
      .find({ company: new Types.ObjectId(companyId) })
      .populate('specialists')
      .populate('category', 'name company')
      .exec();
  }

  async getServiceBy({ id }: { id?: Service['_id'] }) {
    return this.serviceModel.findOne(
      { _id: id ? new Types.ObjectId(id.toString()) : undefined },
      {},
      { populate: [] },
    );
  }

  async updateServiceBy(
    {
      id,
    }: {
      id?: Service['_id'];
    },
    dto: UpdateServiceDto,
  ) {
    const service = await this.serviceModel.findByIdAndUpdate(
      id ? new Types.ObjectId(id.toString()) : undefined,
      dto,
      { new: true },
    );

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    return service;
  }

  async deleteServiceBy({
    id,
    companyId,
  }: {
    id?: Service['_id'] | string;
    companyId?: string;
  }) {
    const query: Record<string, unknown> = {
      _id: id ? new Types.ObjectId(id.toString()) : undefined,
    };

    if (companyId) {
      query.company = new Types.ObjectId(companyId);
    }

    const deletedUser = await this.serviceModel.findOneAndDelete({
      ...query,
    });

    if (!deletedUser) {
      throw new NotFoundException('Service not found');
    }

    await this.specialistModel.updateMany(
      { services: deletedUser._id },
      { $pull: { services: deletedUser._id } },
    );

    return deletedUser;
  }

  async updateService({
    companyId,
    serviceId,
    data,
  }: {
    companyId?: string;
    serviceId: string;
    data: UpdateServiceDto;
  }) {
    const { specialistIds, specialists, categoryId, ...serviceData } = data;
    const currentService = await this.serviceModel.findOne({
      _id: new Types.ObjectId(serviceId),
      ...(companyId ? { company: new Types.ObjectId(companyId) } : {}),
    });

    if (!currentService) {
      throw new NotFoundException('Service not found');
    }

    const query: UpdateQuery<Service> = {
      $set: { ...serviceData } satisfies Partial<Service>,
    };
    const shouldSyncSpecialists =
      specialistIds !== undefined || specialists !== undefined;
    const previousSpecialistIds = this.normalizeObjectIds(
      currentService.specialists as SpecialistReference[],
    );
    const nextSpecialistIds = shouldSyncSpecialists
      ? this.normalizeObjectIds(specialistIds ?? specialists)
      : previousSpecialistIds;

    if (categoryId !== undefined) {
      const category = await this.getAvailableCategory(categoryId, companyId);
      query['$set']['category'] = category._id;
    }

    if (shouldSyncSpecialists) {
      query['$set']['specialists'] = nextSpecialistIds;
    }

    const service = await this.serviceModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(serviceId),
        ...(companyId ? { company: new Types.ObjectId(companyId) } : {}),
      },
      query,
      { new: true },
    );

    if (shouldSyncSpecialists) {
      await this.syncSpecialistsForService({
        serviceId,
        companyId: companyId || currentService.company.toString(),
        previousSpecialistIds,
        nextSpecialistIds,
      });
    }

    return service;
  }

  async removeSpecialistFromService(serviceId: string, specialistId: string) {
    const service = await this.serviceModel.findByIdAndUpdate(
      new Types.ObjectId(serviceId),
      { $pull: { specialists: new Types.ObjectId(specialistId) } },
      { new: true },
    );

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    await this.specialistModel.findByIdAndUpdate(
      new Types.ObjectId(specialistId),
      {
        $pull: { services: new Types.ObjectId(serviceId) },
      },
    );

    return service;
  }

  private normalizeObjectIds(ids?: SpecialistReference[]): Types.ObjectId[] {
    if (!ids?.length) {
      return [];
    }

    return ids.map((id) => {
      const value =
        id instanceof Types.ObjectId
          ? id
          : typeof id === 'string'
            ? id
            : id._id;

      return new Types.ObjectId(value.toString());
    });
  }

  private async getAvailableCategory(categoryId: string, companyId?: string) {
    if (
      !companyId ||
      !Types.ObjectId.isValid(companyId) ||
      !Types.ObjectId.isValid(categoryId)
    ) {
      throw new BadRequestException(
        'Category is not available for this company',
      );
    }

    const category = await this.categoryModel.findOne({
      _id: new Types.ObjectId(categoryId),
      $or: [{ company: null }, { company: new Types.ObjectId(companyId) }],
    });

    if (!category) {
      throw new BadRequestException(
        'Category is not available for this company',
      );
    }

    return category;
  }

  private async syncSpecialistsForService({
    serviceId,
    companyId,
    previousSpecialistIds,
    nextSpecialistIds,
  }: {
    serviceId: string | Types.ObjectId;
    companyId: string;
    previousSpecialistIds: Types.ObjectId[];
    nextSpecialistIds: Types.ObjectId[];
  }) {
    const serviceObjectId = new Types.ObjectId(serviceId.toString());
    const companyObjectId = new Types.ObjectId(companyId);
    const previousIds = previousSpecialistIds.map((id) => id.toString());
    const nextIds = nextSpecialistIds.map((id) => id.toString());
    const idsToAdd = nextSpecialistIds.filter(
      (id) => !previousIds.includes(id.toString()),
    );
    const idsToRemove = previousSpecialistIds.filter(
      (id) => !nextIds.includes(id.toString()),
    );

    if (idsToAdd.length) {
      await this.specialistModel.updateMany(
        {
          _id: { $in: idsToAdd },
          company: companyObjectId,
          active: true,
        },
        { $addToSet: { services: serviceObjectId } },
      );
    }

    if (idsToRemove.length) {
      await this.specialistModel.updateMany(
        {
          _id: { $in: idsToRemove },
          company: companyObjectId,
          active: true,
        },
        { $pull: { services: serviceObjectId } },
      );
    }
  }
}
