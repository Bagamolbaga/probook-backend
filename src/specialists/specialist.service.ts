import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Specialist } from './schema/specialists.schema';
import { User, UserRole } from '../user/schema/user.schema';
import { Service } from '../services/schema/services.schema';

type SafetySpecialist = Omit<Specialist, 'id' | '_id'>;
export type CreateSpecialistDto = Partial<SafetySpecialist>;
export type UpdateSpecialistDto = Partial<SafetySpecialist>;

@Injectable()
export class SpecialistService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(UserRole.SPECIALIST) // или имя дискриминатора, обычно то же, что UserRole.SPECIALIST
    private readonly specialistModel: Model<Specialist>,
    @InjectModel(Service.name) private serviceModel: Model<Service>,
  ) {}

  async createSpecialist(dto: CreateSpecialistDto) {
    const newUser = new this.specialistModel({
      ...dto,
      company: new Types.ObjectId(dto.company as unknown as string),
      role: UserRole.SPECIALIST,
    });
    return newUser.save();
  }

  async getSpecialists({ companyId }: { companyId: Types.ObjectId }) {
    return this.specialistModel
      .find({
        company: new Types.ObjectId(companyId),
        role: UserRole.SPECIALIST,
      })
      .populate('services defaultShift');
  }

  async getSpecialistBy({
    id,
    email,
  }: {
    id?: Specialist['_id'];
    email?: Specialist['email'];
  }) {
    return this.specialistModel.findOne({ $or: [{ _id: id }, { email }] });
  }

  async updateSpecialistBy(
    {
      id,
      email,
      companyId,
    }: {
      id?: Specialist['_id'];
      email?: Specialist['email'];
      companyId?: Specialist['company'] | string;
    },
    dto: UpdateSpecialistDto,
  ) {
    const query: Record<string, unknown> = {};

    if (id) {
      query._id = id;
    }

    if (email) {
      query.email = email;
    }

    if (companyId) {
      query.company = new Types.ObjectId(companyId.toString());
    }

    const specialist = await this.specialistModel.findOneAndUpdate(query, dto, {
      new: true,
    });

    if (!specialist) {
      throw new NotFoundException('Specialist not found');
    }

    return specialist;
  }

  async deleteSpecialistBy({
    id,
    email,
    companyId,
  }: {
    id?: Specialist['_id'];
    email?: Specialist['email'];
    companyId?: Specialist['company'] | string;
  }) {
    const query: Record<string, unknown> = {};

    if (id) {
      query._id = id;
    }

    if (email) {
      query.email = email;
    }

    if (companyId) {
      query.company = new Types.ObjectId(companyId.toString());
    }

    const deletedUser = await this.specialistModel.findOneAndDelete(query);

    if (!deletedUser) {
      throw new NotFoundException('Specialist not found');
    }

    await this.serviceModel.updateMany(
      { specialists: deletedUser._id },
      { $pull: { specialists: deletedUser._id } },
    );

    return deletedUser;
  }
}
