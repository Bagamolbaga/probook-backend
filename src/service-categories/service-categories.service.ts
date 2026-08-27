import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Company } from '../companies/schema/company.schema';
import { Service } from '../services/schema/services.schema';
import { CreateServiceCategoryDto } from './dto/create-service-category.dto';
import { UpdateServiceCategoryDto } from './dto/update-service-category.dto';
import { ServiceCategory } from './schema/service-category.schema';

@Injectable()
export class ServiceCategoriesService {
  constructor(
    @InjectModel(ServiceCategory.name)
    private categoryModel: Model<ServiceCategory>,
    @InjectModel(Company.name) private companyModel: Model<Company>,
    @InjectModel(Service.name) private serviceModel: Model<Service>,
  ) {}

  async getAvailableCategories(companyId: string) {
    const companyObjectId = new Types.ObjectId(companyId);
    const companyExists = await this.companyModel.exists({
      _id: companyObjectId,
    });

    if (!companyExists) {
      throw new NotFoundException('Company not found');
    }

    return this.categoryModel
      .find({
        $or: [{ company: null }, { company: companyObjectId }],
      })
      .sort({ company: 1, name: 1 })
      .exec();
  }

  async createCompanyCategory(
    companyId: string,
    dto: CreateServiceCategoryDto,
  ) {
    const companyObjectId = new Types.ObjectId(companyId);
    const companyExists = await this.companyModel.exists({
      _id: companyObjectId,
    });

    if (!companyExists) {
      throw new NotFoundException('Company not found');
    }

    const name = dto.name.trim();
    const category = new this.categoryModel({
      name,
      normalizedName: this.normalizeName(name),
      company: companyObjectId,
    });

    try {
      return await category.save();
    } catch (error) {
      this.handleDuplicateName(error);
      throw error;
    }
  }

  async updateCompanyCategory(
    companyId: string,
    categoryId: string,
    dto: UpdateServiceCategoryDto,
  ) {
    const name = dto.name?.trim();
    const data =
      name === undefined
        ? {}
        : { name, normalizedName: this.normalizeName(name) };

    try {
      const category = await this.categoryModel.findOneAndUpdate(
        {
          _id: new Types.ObjectId(categoryId),
          company: new Types.ObjectId(companyId),
        },
        { $set: data },
        { new: true, runValidators: true },
      );

      if (!category) {
        throw new NotFoundException('Category not found');
      }

      return category;
    } catch (error) {
      this.handleDuplicateName(error);
      throw error;
    }
  }

  async deleteCompanyCategory(companyId: string, categoryId: string) {
    const companyObjectId = new Types.ObjectId(companyId);
    const categoryObjectId = new Types.ObjectId(categoryId);
    const category = await this.categoryModel.findOne({
      _id: categoryObjectId,
      company: companyObjectId,
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    const isUsed = await this.serviceModel.exists({
      category: categoryObjectId,
      company: companyObjectId,
    });

    if (isUsed) {
      throw new ConflictException('Category is used by services');
    }

    const deletedCategory = await this.categoryModel.findOneAndDelete({
      _id: categoryObjectId,
      company: companyObjectId,
    });

    if (!deletedCategory) {
      throw new NotFoundException('Category not found');
    }

    return deletedCategory;
  }

  private normalizeName(name: string) {
    return name.trim().toLocaleLowerCase();
  }

  private handleDuplicateName(error: unknown) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: number }).code === 11000
    ) {
      throw new ConflictException('Category with this name already exists');
    }
  }
}
