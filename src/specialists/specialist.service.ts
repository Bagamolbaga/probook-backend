import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Specialist } from './schema/specialists.schema';
import { User, UserRole } from 'src/user/schema/user.schema';

type SafetySpecialist = Omit<Specialist, 'id' | '_id'>;
export type CreateSpecialistDto = Partial<SafetySpecialist>;
export type UpdateSpecialistDto = Partial<SafetySpecialist>;

@Injectable()
export class SpecialistService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(UserRole.SPECIALIST) // или имя дискриминатора, обычно то же, что UserRole.SPECIALIST
    private readonly specialistModel: Model<Specialist>,
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
      .populate('services');
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
    }: {
      id?: Specialist['_id'];
      email?: Specialist['email'];
    },
    dto: UpdateSpecialistDto,
  ) {
    return this.specialistModel.updateOne({ _id: id, email }, dto);
  }

  async deleteSpecialistBy({
    id,
    email,
  }: {
    id?: Specialist['_id'];
    email?: Specialist['email'];
  }) {
    const deletedUser = await this.specialistModel.findOneAndDelete({
      _id: id,
      email,
    });

    if (!deletedUser) {
      throw new NotFoundException('Specialist not found');
    }

    return deletedUser;
  }
}
