import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, UpdateQuery } from 'mongoose';
import { Shift, ShiftKind } from './schema/shift.schema';
import {
  CreateDefaultShiftDto,
  CreateShiftDto,
  CreateShiftOverrideDto,
  ShiftDto,
  UpdateShiftDto,
} from './dto/shift.dto';

export type EffectiveShiftSource =
  | 'override'
  | 'specialist_default'
  | 'company_default'
  | 'company_schedule';

export type EffectiveShift = {
  source: EffectiveShiftSource;
  shift: ShiftDto | null;
  workingSlots: number[];
  breakSlots: number[];
};

@Injectable()
export class ShiftService {
  constructor(@InjectModel(Shift.name) private shiftModel: Model<Shift>) {}

  toDto(shift: Shift): ShiftDto {
    const obj = shift.toObject ? shift.toObject() : shift;
    const legacySlots = (obj as unknown as { slots?: number[] }).slots;
    const id = obj.id || obj._id?.toString();
    const companyId = obj.company?.toString();
    const specialistId = obj.specialist ? obj.specialist.toString() : null;
    const kind = obj.kind;

    return {
      id,
      companyId,
      specialistId,
      kind,
      name: obj.name,
      description: obj.description,
      color: obj.color,
      date: obj.date ? this.formatDate(obj.date) : null,
      workingSlots: obj.workingSlots || legacySlots || [],
      breakSlots: obj.breakSlots || [],
      createdAt: obj.createdAt?.toISOString?.(),
      updatedAt: obj.updatedAt?.toISOString?.(),
    };
  }

  async createShift(companyId: Types.ObjectId | string, dto: CreateShiftDto) {
    if ('specialistId' in dto) {
      return this.createShiftOverride(companyId, dto);
    }

    return this.createDefaultShift(companyId, dto);
  }

  async createDefaultShift(
    companyId: Types.ObjectId | string,
    dto: CreateDefaultShiftDto,
  ) {
    const shift = await this.shiftModel.create({
      ...dto,
      breakSlots: dto.breakSlots || [],
      company: new Types.ObjectId(companyId),
      kind: ShiftKind.DEFAULT,
      specialist: null,
      date: null,
    });

    return this.toDto(shift);
  }

  async createShiftOverride(
    companyId: Types.ObjectId | string,
    dto: CreateShiftOverrideDto,
  ) {
    const shift = await this.shiftModel.create({
      ...dto,
      breakSlots: dto.breakSlots || [],
      company: new Types.ObjectId(companyId),
      specialist: new Types.ObjectId(dto.specialistId),
      date: this.parseDateOnly(dto.date),
      kind: ShiftKind.OVERRIDE,
    });

    return this.toDto(shift);
  }

  async getCompanyShifts({ companyId }: { companyId: Types.ObjectId }) {
    const shifts = await this.shiftModel.find({
      company: new Types.ObjectId(companyId),
    });

    return shifts.map((shift) => this.toDto(shift));
  }

  async getShiftBy({ id }: { id?: Shift['_id'] }) {
    const shift = await this.shiftModel.findOne(
      { _id: id ? new Types.ObjectId(id.toString()) : undefined },
      {},
      { populate: [] },
    );
    return shift ? this.toDto(shift) : null;
  }

  async updateShiftById({
    id,
    companyId,
    data,
  }: {
    id?: Shift['_id'];
    companyId: Shift['company'] | string;
    data: UpdateShiftDto;
  }) {
    const shift = await this.shiftModel.findOneAndUpdate(
      {
        _id: id ? new Types.ObjectId(id.toString()) : undefined,
        company: new Types.ObjectId(companyId.toString()),
      },
      data,
      { new: true },
    );

    if (!shift) {
      throw new NotFoundException('Shift not found');
    }

    return this.toDto(shift);
  }

  async deleteShiftBy({
    id,
    companyId,
  }: {
    id?: Shift['_id'];
    companyId: Shift['company'] | string;
  }) {
    const deletedShift = await this.shiftModel.findOneAndDelete({
      _id: id ? new Types.ObjectId(id.toString()) : undefined,
      company: new Types.ObjectId(companyId.toString()),
    });

    if (!deletedShift) {
      throw new NotFoundException('Shift not found');
    }

    return deletedShift;
  }

  async getEffectiveShift({
    companyId,
    specialistId,
    date,
    fallbackWorkingSlots = [],
    fallbackBreakSlots = [],
  }: {
    companyId: Types.ObjectId | string;
    specialistId: Types.ObjectId | string;
    date: string | Date;
    fallbackWorkingSlots?: number[];
    fallbackBreakSlots?: number[];
  }): Promise<EffectiveShift> {
    const companyObjectId = new Types.ObjectId(companyId);
    const specialistObjectId = new Types.ObjectId(specialistId);
    const dateOnly = typeof date === 'string' ? this.parseDateOnly(date) : date;

    const override = await this.shiftModel.findOne({
      company: companyObjectId,
      specialist: specialistObjectId,
      kind: ShiftKind.OVERRIDE,
      date: dateOnly,
    });

    if (override) {
      const dto = this.toDto(override);
      return {
        source: 'override',
        shift: dto,
        workingSlots: dto.workingSlots,
        breakSlots: dto.breakSlots,
      };
    }

    const specialistDefault = await this.shiftModel.findOne({
      company: companyObjectId,
      specialist: specialistObjectId,
      kind: ShiftKind.DEFAULT,
      date: null,
    });

    if (specialistDefault) {
      const dto = this.toDto(specialistDefault);
      return {
        source: 'specialist_default',
        shift: dto,
        workingSlots: dto.workingSlots,
        breakSlots: dto.breakSlots,
      };
    }

    const companyDefault = await this.shiftModel.findOne({
      company: companyObjectId,
      specialist: null,
      kind: ShiftKind.DEFAULT,
      date: null,
    });

    if (companyDefault) {
      const dto = this.toDto(companyDefault);
      return {
        source: 'company_default',
        shift: dto,
        workingSlots: dto.workingSlots,
        breakSlots: dto.breakSlots,
      };
    }

    return {
      source: 'company_schedule',
      shift: null,
      workingSlots: fallbackWorkingSlots,
      breakSlots: fallbackBreakSlots,
    };
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
      query['$set']['specialists'] = specialistIds.map(
        (id) => new Types.ObjectId(id),
      );
    }

    return this.shiftModel.findByIdAndUpdate(
      new Types.ObjectId(shiftId),
      query,
      { new: true },
    );
  }

  async removeSpecialistFromShift(shiftId: string, specialistId: string) {
    return this.shiftModel.findByIdAndUpdate(
      new Types.ObjectId(shiftId),
      { $pull: { specialists: new Types.ObjectId(specialistId) } },
      { new: true },
    );
  }

  private parseDateOnly(date: string) {
    return new Date(`${date.slice(0, 10)}T00:00:00.000Z`);
  }

  private formatDate(date: Date | string) {
    if (date instanceof Date) {
      return date.toISOString().slice(0, 10);
    }

    return new Date(date).toISOString().slice(0, 10);
  }
}
