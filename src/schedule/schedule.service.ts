import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  CreateScheduleDto,
  ScheduleDayDto,
  ScheduleDto,
  UpdateScheduleDto,
} from './dto/schedule.dto';
import { Schedule, ScheduleType } from './schema/schedule.schema';

@Injectable()
export class ScheduleService {
  constructor(@InjectModel(Schedule.name) private scheduleModel: Model<Schedule>) {}

  async createSchedule(companyId: string, dto: CreateScheduleDto) {
    this.assertValidDays(dto.days, dto.type || ScheduleType.WEEKLY);

    const schedule = await this.scheduleModel.create({
      company: new Types.ObjectId(companyId),
      specialist: new Types.ObjectId(dto.specialistId),
      type: dto.type || ScheduleType.WEEKLY,
      activeFrom: this.parseDateOnly(dto.activeFrom),
      activeTo: dto.activeTo ? this.parseDateOnly(dto.activeTo) : null,
      cycleLengthDays: dto.cycleLengthDays,
      days: dto.days.map((day) => ({
        day: day.day,
        shift: day.shiftId ? new Types.ObjectId(day.shiftId) : null,
      })),
    });

    return this.toDto(schedule);
  }

  async getCompanySchedules(companyId: string) {
    const schedules = await this.scheduleModel.find({
      company: new Types.ObjectId(companyId),
    });

    return schedules.map((schedule) => this.toDto(schedule));
  }

  async getSpecialistSchedules(companyId: string, specialistId: string) {
    const schedules = await this.scheduleModel.find({
      company: new Types.ObjectId(companyId),
      specialist: new Types.ObjectId(specialistId),
    });

    return schedules.map((schedule) => this.toDto(schedule));
  }

  async getScheduleById(companyId: string, scheduleId: string) {
    const schedule = await this.scheduleModel.findOne({
      _id: new Types.ObjectId(scheduleId),
      company: new Types.ObjectId(companyId),
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    return this.toDto(schedule);
  }

  async updateSchedule(companyId: string, scheduleId: string, dto: UpdateScheduleDto) {
    if (dto.days) {
      this.assertValidDays(dto.days, ScheduleType.WEEKLY);
    }

    const update: Record<string, unknown> = { ...dto };

    if (dto.activeFrom) {
      update.activeFrom = this.parseDateOnly(dto.activeFrom);
    }

    if (dto.activeTo !== undefined) {
      update.activeTo = dto.activeTo ? this.parseDateOnly(dto.activeTo) : null;
    }

    if (dto.days) {
      update.days = dto.days.map((day) => ({
        day: day.day,
        shift: day.shiftId ? new Types.ObjectId(day.shiftId) : null,
      }));
    }

    const schedule = await this.scheduleModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(scheduleId),
        company: new Types.ObjectId(companyId),
      },
      update,
      { new: true },
    );

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    return this.toDto(schedule);
  }

  async deleteSchedule(companyId: string, scheduleId: string) {
    const schedule = await this.scheduleModel.findOneAndDelete({
      _id: new Types.ObjectId(scheduleId),
      company: new Types.ObjectId(companyId),
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    return this.toDto(schedule);
  }

  toDto(schedule: Schedule): ScheduleDto {
    const obj = schedule.toObject ? schedule.toObject() : schedule;

    return {
      id: obj.id || obj._id?.toString(),
      companyId: obj.company?.toString(),
      specialistId: obj.specialist?.toString(),
      type: obj.type,
      activeFrom: this.formatDate(obj.activeFrom),
      activeTo: obj.activeTo ? this.formatDate(obj.activeTo) : null,
      cycleLengthDays: obj.cycleLengthDays,
      days: (obj.days || []).map((day) => ({
        day: day.day,
        shiftId: day.shift ? day.shift.toString() : null,
      })),
      createdAt: obj.createdAt?.toISOString?.(),
      updatedAt: obj.updatedAt?.toISOString?.(),
    };
  }

  private assertValidDays(days: ScheduleDayDto[], type: ScheduleType) {
    if (!days?.length) {
      throw new BadRequestException('Schedule days are required');
    }

    if (type === ScheduleType.WEEKLY) {
      const invalidDay = days.find((day) => day.day < 0 || day.day > 6);

      if (invalidDay) {
        throw new BadRequestException('Weekly schedule day must be between 0 and 6');
      }
    }
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
