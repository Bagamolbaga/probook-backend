import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, UpdateQuery } from 'mongoose';
import { Shift } from './schema/shift.schema';

type SafetyShift = Omit<Shift, 'id' | '_id'>;
export type CreateShiftDto = Partial<SafetyShift>;
export type UpdateShiftDto = Partial<SafetyShift>;

@Injectable()
export class ShiftService {
  constructor(@InjectModel(Shift.name) private shiftModel: Model<Shift>) {}

  async createShift(dto: CreateShiftDto) {
    const newUser = new this.shiftModel(dto);
    return newUser.save();
  }

  async getCompanyShifts({ companyId }: { companyId: Types.ObjectId }) {
    return this.shiftModel.find({ company: companyId });
  }

  async getShiftBy({ id }: { id?: Shift['_id'] }) {
    return this.shiftModel.findOne({ _id: id }, {}, { populate: [] });
  }

  async updateShiftById({
    id,
    data,
  }: {
    id?: Shift['_id'];
    data: UpdateShiftDto;
  }) {
    return this.shiftModel.updateOne({ _id: id }, data);
  }

  async deleteShiftBy({ id }: { id?: Shift['_id'] }) {
    const deletedUser = await this.shiftModel.findOneAndDelete({
      _id: id,
    });

    if (!deletedUser) {
      throw new NotFoundException('Shift not found');
    }

    return deletedUser;
  }

  async updateShift({
    shiftId,
    data,
  }: {
    shiftId: string;
    data: Partial<Shift> & {
      specialistIds?: string[];
    };
  }) {
    const { specialistIds, ...shiftData } = data;

    const query: UpdateQuery<Shift> = {
      $set: { ...shiftData } satisfies Partial<Shift>,
    };

    if (specialistIds) {
      query['$set']['specialists'] = specialistIds;
    }

    return this.shiftModel.findByIdAndUpdate(shiftId, query, { new: true });
  }

  async removeSpecialistFromShift(shiftId: string, specialistId: string) {
    return this.shiftModel.findByIdAndUpdate(
      shiftId,
      { $pull: { specialists: specialistId } },
      { new: true },
    );
  }
}
