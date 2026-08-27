import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Company } from './schema/company.schema';
import { Shift } from '../shift/schema/shift.schema';
import { Service } from '../services/schema/services.schema';
// import { Service } from 'src/services/schema/services.schema';

type SafetyCompany = Omit<Company, 'id' | '_id'>;
export type CreateCompanyDto = Partial<SafetyCompany>;
export type UpdateCompanyDto = Partial<SafetyCompany>;

@Injectable()
export class CompanyService {
  constructor(
    @InjectModel(Company.name) private companyModel: Model<Company>,
    @InjectModel(Service.name) private serviceModel: Model<Service>,
    @InjectModel(Shift.name) private shiftModel: Model<Shift>,
  ) {}

  async createCompany(dto: CreateCompanyDto) {
    const newUser = new this.companyModel({
      ...dto,
      owner: new Types.ObjectId(dto.owner as unknown as string),
    });
    return newUser.save();
  }

  async getCompanies() {
    const companies = await this.companyModel
      .find()
      .populate('services')
      .lean()
      .exec();

    return companies.map((company) => {
      const allPrices =
        company.services?.flatMap(
          (s) => s.options?.map((o) => o.price) ?? [],
        ) ?? [];
      const minPrice = allPrices.length > 0 ? Math.min(...allPrices) : null;
      const maxPrice = allPrices.length > 0 ? Math.max(...allPrices) : null;

      return {
        ...company, // или company.toJSON() если нужно
        priceFrom: minPrice,
        priceTo: maxPrice,
      };
    });
  }

  async getCompanyBy({ id }: { id?: Company['_id'] }) {
    const company = await this.companyModel
      .findById(id)
      .populate('owner')
      .lean();

    const shifts = await this.shiftModel.find({ company: id }).lean();

    return {
      ...company,
      shifts,
    };
  }

  async updateCompanyBy(
    {
      id,
      ownerId,
    }: {
      id?: Company['_id'];
      ownerId?: Company['owner'];
    },
    dto: UpdateCompanyDto,
  ) {
    const company = await this.companyModel.findOneAndUpdate(
      { _id: id, owner: ownerId },
      dto,
      { new: true },
    );

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    return company;
  }

  async deleteCompanyBy({
    id,
    ownerId,
  }: {
    id?: Company['_id'];
    ownerId?: Company['owner'];
  }) {
    const deletedUser = await this.companyModel.findOneAndDelete({
      _id: id,
      owner: ownerId,
    });

    if (!deletedUser) {
      throw new NotFoundException('Company not found');
    }

    return deletedUser;
  }
}
