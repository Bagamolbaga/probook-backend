import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, UpdateQuery } from 'mongoose';
import { Service } from './schema/services.schema';

type SafetyService = Omit<Service, 'id' | '_id'>;
export type CreateServiceDto = Partial<SafetyService> & { companyId: string };
export type UpdateServiceDto = Partial<SafetyService>;

@Injectable()
export class ServiceService {
  constructor(
    @InjectModel(Service.name) private serviceModel: Model<Service>,
  ) {}

  async createService(dto: CreateServiceDto) {
    const newUser = new this.serviceModel({
      ...dto,
      company: new Types.ObjectId(dto.companyId),
    });
    return newUser.save();
  }

  async getCompanyServices({ companyId }: { companyId: string }) {
    return this.serviceModel.find(
      { company: new Types.ObjectId(companyId) },
      {},
      { populate: ['specialists'] },
    );
  }

  async getServiceBy({ id }: { id?: Service['_id'] }) {
    return this.serviceModel.findOne({ _id: id }, {}, { populate: [] });
  }

  async updateServiceBy(
    {
      id,
    }: {
      id?: Service['_id'];
    },
    dto: UpdateServiceDto,
  ) {
    return this.serviceModel.updateOne({ _id: id }, dto);
  }

  async deleteServiceBy({ id }: { id?: Service['_id'] }) {
    const deletedUser = await this.serviceModel.findOneAndDelete({
      _id: id,
    });

    if (!deletedUser) {
      throw new NotFoundException('Service not found');
    }

    return deletedUser;
  }

  async updateService({
    serviceId,
    data,
  }: {
    serviceId: string;
    data: Partial<Service> & {
      specialistIds?: string[];
    };
  }) {
    const { specialistIds, ...serviceData } = data;

    const query: UpdateQuery<Service> = {
      $set: { ...serviceData } satisfies Partial<Service>,
    };

    if (specialistIds) {
      query['$set']['specialists'] = specialistIds;
    }

    return this.serviceModel.findByIdAndUpdate(serviceId, query, { new: true });
  }

  async removeSpecialistFromService(serviceId: string, specialistId: string) {
    return this.serviceModel.findByIdAndUpdate(
      serviceId,
      { $pull: { specialists: specialistId } },
      { new: true },
    );
  }
}
