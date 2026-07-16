import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Booking, BookingStatus } from 'src/booking/schema/booking.schema';
import { Company } from 'src/companies/schema/company.schema';
import { Schedule, ScheduleType } from 'src/schedule/schema/schedule.schema';
import { Shift, ShiftKind } from 'src/shift/schema/shift.schema';
import { Specialist } from 'src/specialists/schema/specialists.schema';
import { UserRole } from 'src/user/schema/user.schema';
import {
  AssertSlotsAreBookableInput,
  AvailabilityResult,
  EffectiveShift,
  ScheduleRangeDto,
} from './availability.types';
import { ShiftDto } from 'src/shift/dto/shift.dto';

const WEEK_DAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

const BUSY_BOOKING_STATUSES = [
  BookingStatus.BLOCKED,
  BookingStatus.PENDING,
  BookingStatus.CONFIRMED,
];

@Injectable()
export class AvailabilityService {
  constructor(
    @InjectModel(Company.name) private companyModel: Model<Company>,
    @InjectModel(Shift.name) private shiftModel: Model<Shift>,
    @InjectModel(Schedule.name) private scheduleModel: Model<Schedule>,
    @InjectModel(Booking.name) private bookingModel: Model<Booking>,
    @InjectModel(UserRole.SPECIALIST)
    private specialistModel: Model<Specialist>,
  ) {}

  async getAvailability({
    companyId,
    specialistId,
    date,
    excludeBookingId,
  }: AssertSlotsAreBookableInput): Promise<AvailabilityResult> {
    const effectiveShift = await this.getEffectiveShift({
      companyId,
      specialistId,
      date,
    });
    const busySlots = await this.getBusySlots({
      companyId,
      specialistId,
      date,
      excludeBookingId,
    });
    const busySlotSet = new Set(busySlots);
    const breakSlotSet = new Set(effectiveShift.breakSlots);
    const workingSlotSet = new Set(effectiveShift.slots);

    const availableSlots = effectiveShift.slots.filter(
      (slot) => !breakSlotSet.has(slot) && !busySlotSet.has(slot),
    );

    return {
      companyId,
      specialistId,
      date: this.formatDate(date),
      shiftId: effectiveShift.shift?.id || null,
      source: effectiveShift.source,
      workingSlots: effectiveShift.slots,
      breakSlots: effectiveShift.breakSlots,
      busySlots,
      availableSlots,
      slots: effectiveShift.slots.map((slot) => ({
        slot,
        available: availableSlots.includes(slot),
        reason: !workingSlotSet.has(slot)
          ? 'outside_shift'
          : breakSlotSet.has(slot)
            ? 'break'
            : busySlotSet.has(slot)
              ? 'busy'
              : undefined,
      })),
    };
  }

  async assertSlotsAreBookable(input: AssertSlotsAreBookableInput) {
    const requestedSlots = this.normalizeSlots(input.slots);

    if (!requestedSlots.length) {
      throw new BadRequestException('Booking slots are required');
    }

    if (!this.areContinuousSlots(requestedSlots)) {
      throw new BadRequestException('Booking slots must be continuous');
    }

    const availability = await this.getAvailability({
      ...input,
      slots: requestedSlots,
    });
    const availableSlotSet = new Set(availability.availableSlots);
    const unavailableSlot = requestedSlots.find(
      (slot) => !availableSlotSet.has(slot),
    );

    if (unavailableSlot !== undefined) {
      throw new BadRequestException(
        `Slot ${unavailableSlot} is not available for booking`,
      );
    }

    return availability;
  }

  async getScheduleRange({
    companyId,
    specialistId,
    start,
    end,
    includeAvailability = false,
  }: {
    companyId: string;
    specialistId: string;
    start: string;
    end: string;
    includeAvailability?: boolean;
  }): Promise<ScheduleRangeDto> {
    const startDate = this.parseDateOnly(start);
    const endDate = this.parseDateOnly(end);

    if (startDate > endDate) {
      throw new BadRequestException('Schedule range start must be before end');
    }

    const dates = this.getDatesInRange(startDate, endDate);
    const days = await Promise.all(
      dates.map(async (date) => {
        const dateString = this.formatDate(date);

        if (includeAvailability) {
          const availability = await this.getAvailability({
            companyId,
            specialistId,
            date: dateString,
            slots: [],
          });

          return {
            date: dateString,
            source: availability.source,
            shiftId: availability.shiftId,
            shiftName: null,
            slots: availability.workingSlots,
            breakSlots: availability.breakSlots,
            busySlots: availability.busySlots,
            availableSlots: availability.availableSlots,
          };
        }

        const effectiveShift = await this.getEffectiveShift({
          companyId,
          specialistId,
          date: dateString,
        });

        return {
          date: dateString,
          source: effectiveShift.source,
          shiftId: effectiveShift.shift?.id || null,
          shiftName: effectiveShift.shift?.name || null,
          slots: effectiveShift.slots,
          breakSlots: effectiveShift.breakSlots,
        };
      }),
    );

    return {
      companyId,
      specialistId,
      start: this.formatDate(startDate),
      end: this.formatDate(endDate),
      days,
    };
  }

  async getEffectiveShift({
    companyId,
    specialistId,
    date,
  }: {
    companyId: string;
    specialistId: string;
    date: string;
  }): Promise<EffectiveShift> {
    const companyObjectId = new Types.ObjectId(companyId);
    const specialistObjectId = new Types.ObjectId(specialistId);
    const dateOnly = this.parseDateOnly(date);

    const [company, specialist] = await Promise.all([
      this.companyModel.findById(companyObjectId).lean(),
      this.specialistModel.findById(specialistObjectId).lean(),
    ]);

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    if (!specialist) {
      throw new NotFoundException('Specialist not found');
    }

    if (specialist.company?.toString() !== companyObjectId.toString()) {
      throw new BadRequestException('Specialist does not belong to company');
    }

    const override = await this.shiftModel.findOne({
      company: companyObjectId,
      specialist: specialistObjectId,
      kind: ShiftKind.OVERRIDE,
      date: dateOnly,
    });

    if (override) {
      return this.toEffectiveShift('override', override);
    }

    const scheduleShift = await this.getScheduleShift({
      companyId: companyObjectId,
      specialistId: specialistObjectId,
      date: dateOnly,
    });

    if (scheduleShift.found && !scheduleShift.shift) {
      return {
        source: 'off',
        shift: null,
        slots: [],
        breakSlots: [],
      };
    }

    if (scheduleShift.shift) {
      return this.toEffectiveShift('schedule', scheduleShift.shift);
    }

    if (specialist.defaultShift) {
      const specialistDefault = await this.shiftModel.findOne({
        _id: specialist.defaultShift,
        company: companyObjectId,
      });

      if (specialistDefault) {
        return this.toEffectiveShift('specialist_default', specialistDefault);
      }
    }

    const companyDefault = await this.shiftModel.findOne({
      company: companyObjectId,
      specialist: null,
      kind: ShiftKind.DEFAULT,
      date: null,
    });

    if (companyDefault) {
      return this.toEffectiveShift('company_default', companyDefault);
    }

    const weekdaySchedule = this.getCompanyWorkingScheduleForDate(
      company,
      dateOnly,
    );
    return {
      source: 'company_schedule',
      shift: null,
      slots: weekdaySchedule.workingSlots,
      breakSlots: weekdaySchedule.breakSlots,
    };
  }

  async getBusySlots({
    companyId,
    specialistId,
    date,
    excludeBookingId,
  }: {
    companyId: string;
    specialistId: string;
    date: string;
    excludeBookingId?: string;
  }) {
    const specialistObjectId = new Types.ObjectId(specialistId);
    const query: Record<string, unknown> = {
      company: new Types.ObjectId(companyId),
      date: this.formatDate(date),
      status: { $in: BUSY_BOOKING_STATUSES },
      $or: [
        { 'specialist._id': specialistObjectId },
        { 'specialist._id': specialistId },
        { 'specialist.id': specialistId },
      ],
    };

    if (excludeBookingId) {
      query._id = { $ne: new Types.ObjectId(excludeBookingId) };
    }

    const bookings = await this.bookingModel.find(query).select('slots').lean();
    const busySlots = bookings.flatMap((booking) => booking.slots || []);

    return this.normalizeSlots(busySlots);
  }

  private toEffectiveShift(
    source: EffectiveShift['source'],
    shift: Shift,
  ): EffectiveShift {
    const dto = this.toShiftDto(shift);
    return {
      source,
      shift: dto,
      slots: dto.slots,
      breakSlots: dto.breakSlots,
    };
  }

  private toShiftDto(shift: Shift): ShiftDto {
    const obj = shift.toObject ? shift.toObject() : shift;
    const legacyDefault = (obj as unknown as { default?: boolean }).default;
    const kind =
      obj.kind ||
      (legacyDefault === false ? ShiftKind.OVERRIDE : ShiftKind.DEFAULT);

    return {
      id: obj.id || obj._id?.toString(),
      companyId: obj.company?.toString(),
      specialistId: obj.specialist ? obj.specialist.toString() : null,
      kind,
      name: obj.name,
      description: obj.description,
      color: obj.color,
      date: obj.date ? this.formatDate(obj.date) : null,
      slots: obj.slots || [],
      breakSlots: obj.breakSlots || [],
      createdAt: obj.createdAt?.toISOString?.(),
      updatedAt: obj.updatedAt?.toISOString?.(),
    };
  }

  private getCompanyWorkingScheduleForDate(company: Company, date: Date) {
    const weekDay = WEEK_DAYS[date.getUTCDay()];
    const schedule =
      (company as unknown as { workingSchedule?: Record<string, any> })
        .workingSchedule || {};
    const daySchedule = schedule[weekDay] || {};

    return {
      workingSlots: daySchedule.workingSlots || daySchedule.slots || [],
      breakSlots: daySchedule.breakSlots || daySchedule.breaks || [],
    };
  }

  private async getScheduleShift({
    companyId,
    specialistId,
    date,
  }: {
    companyId: Types.ObjectId;
    specialistId: Types.ObjectId;
    date: Date;
  }): Promise<{ found: boolean; shift: Shift | null }> {
    const schedule = await this.scheduleModel
      .findOne({
        company: companyId,
        specialist: specialistId,
        activeFrom: { $lte: date },
        $or: [{ activeTo: null }, { activeTo: { $gte: date } }],
      })
      .sort({ activeFrom: -1 });

    if (!schedule) {
      return { found: false, shift: null };
    }

    if (schedule.type === ScheduleType.CYCLE) {
      return { found: false, shift: null };
    }

    const weekDay = date.getUTCDay();
    const scheduleDay = schedule.days.find((day) => day.day === weekDay);

    if (!scheduleDay) {
      return { found: false, shift: null };
    }

    if (!scheduleDay.shift) {
      return { found: true, shift: null };
    }

    const shift = await this.shiftModel.findOne({
      _id: scheduleDay.shift,
      company: companyId,
    });

    return { found: true, shift };
  }

  private normalizeSlots(slots: number[]) {
    return [...new Set(slots)].sort((a, b) => a - b);
  }

  private areContinuousSlots(slots: number[]) {
    return slots.every(
      (slot, index) => index === 0 || slot - slots[index - 1] === 1,
    );
  }

  private parseDateOnly(date: string) {
    return new Date(`${date.slice(0, 10)}T00:00:00.000Z`);
  }

  private getDatesInRange(start: Date, end: Date) {
    const dates: Date[] = [];
    const current = new Date(start);

    while (current <= end) {
      dates.push(new Date(current));
      current.setUTCDate(current.getUTCDate() + 1);
    }

    return dates;
  }

  private formatDate(date: Date | string) {
    if (date instanceof Date) {
      return date.toISOString().slice(0, 10);
    }

    return new Date(date).toISOString().slice(0, 10);
  }
}
