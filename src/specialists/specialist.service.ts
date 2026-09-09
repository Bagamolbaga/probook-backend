import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { Specialist } from './schema/specialists.schema';
import { Service } from '../services/schema/services.schema';

export type CreateSpecialistDto = {
  userId: string | Types.ObjectId;
  company: string | Types.ObjectId;
  specialties?: string[];
  bio?: string;
  services?: Types.ObjectId[];
  defaultShift?: Types.ObjectId;
};
export type UpdateSpecialistDto = Partial<
  Pick<
    Specialist,
    'specialties' | 'bio' | 'services' | 'defaultShift' | 'active'
  >
>;

@Injectable()
export class SpecialistService {
  constructor(
    @InjectModel(Specialist.name)
    private readonly specialistModel: Model<Specialist>,
    @InjectModel(Service.name) private serviceModel: Model<Service>,
  ) {}

  async createSpecialist(dto: CreateSpecialistDto, session?: ClientSession) {
    const updates: Record<string, unknown> = { active: true };
    if (dto.specialties !== undefined) updates.specialties = dto.specialties;
    if (dto.bio !== undefined) updates.bio = dto.bio;
    if (dto.services !== undefined) updates.services = dto.services;
    if (dto.defaultShift !== undefined) updates.defaultShift = dto.defaultShift;

    const profile = await this.specialistModel.findOneAndUpdate(
      {
        userId: new Types.ObjectId(dto.userId.toString()),
        company: new Types.ObjectId(dto.company.toString()),
      },
      {
        $setOnInsert: {
          userId: new Types.ObjectId(dto.userId.toString()),
          company: new Types.ObjectId(dto.company.toString()),
        },
        $set: updates,
      },
      { new: true, upsert: true, setDefaultsOnInsert: true, session },
    );

    if (dto.services !== undefined) {
      const companyId = new Types.ObjectId(dto.company.toString());
      await this.serviceModel.updateMany(
        { company: companyId, specialists: profile._id },
        { $pull: { specialists: profile._id } },
        { session },
      );
      if (dto.services.length > 0) {
        await this.serviceModel.updateMany(
          { _id: { $in: dto.services }, company: companyId },
          { $addToSet: { specialists: profile._id } },
          { session },
        );
      }
    }

    return profile;
  }

  async getSpecialists({
    companyId,
    includeEmail = false,
  }: {
    companyId: Types.ObjectId;
    includeEmail?: boolean;
  }) {
    const profiles = await this.specialistModel
      .find({ company: new Types.ObjectId(companyId), active: true })
      .populate(
        'userId',
        includeEmail
          ? 'email firstName lastName avatar'
          : 'firstName lastName avatar',
      )
      .populate('services defaultShift')
      .lean();
    return profiles.map((profile: any) =>
      this.flattenIdentity(profile, includeEmail),
    );
  }

  getSpecialistBy({
    id,
    userId,
    companyId,
  }: {
    id?: Specialist['_id'];
    userId?: string | Types.ObjectId;
    companyId?: string | Types.ObjectId;
  }) {
    const query: Record<string, unknown> = {};
    if (id) query._id = new Types.ObjectId(id.toString());
    if (userId) query.userId = new Types.ObjectId(userId.toString());
    if (companyId) query.company = new Types.ObjectId(companyId.toString());
    return this.specialistModel
      .findOne(query)
      .populate('userId', 'email firstName lastName avatar');
  }

  async updateSpecialistBy(
    {
      id,
      companyId,
    }: { id?: Specialist['_id']; companyId?: Specialist['company'] | string },
    dto: UpdateSpecialistDto,
  ) {
    const specialist = await this.specialistModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(id.toString()),
          company: new Types.ObjectId(companyId.toString()),
        },
        { $set: dto },
        { new: true, runValidators: true },
      )
      .populate('userId', 'email firstName lastName avatar');
    if (!specialist) throw new NotFoundException('Specialist not found');

    if (dto.services !== undefined) {
      await this.serviceModel.updateMany(
        { company: specialist.company, specialists: specialist._id },
        { $pull: { specialists: specialist._id } },
      );
      if (dto.services.length > 0) {
        await this.serviceModel.updateMany(
          { _id: { $in: dto.services }, company: specialist.company },
          { $addToSet: { specialists: specialist._id } },
        );
      }
    }

    return specialist;
  }

  async deleteSpecialistBy({
    id,
    companyId,
  }: {
    id?: Specialist['_id'];
    companyId?: Specialist['company'] | string;
  }) {
    const specialist = await this.specialistModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(id.toString()),
        company: new Types.ObjectId(companyId.toString()),
      },
      { $set: { active: false } },
      { new: true },
    );
    if (!specialist) throw new NotFoundException('Specialist not found');
    await this.serviceModel.updateMany(
      { specialists: specialist._id },
      { $pull: { specialists: specialist._id } },
    );
    return specialist;
  }

  private flattenIdentity(profile: any, includeEmail: boolean) {
    const user = profile.userId;
    return {
      ...profile,
      id: profile._id.toString(),
      userId: user?._id || user,
      ...(includeEmail ? { email: user?.email } : {}),
      firstName: user?.firstName,
      lastName: user?.lastName,
      avatar: user?.avatar,
      fullName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
    };
  }
}
