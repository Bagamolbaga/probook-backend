import { ShiftDto } from 'src/shift/dto/shift.dto';

export type EffectiveShiftSource =
  | 'override'
  | 'schedule'
  | 'off'
  | 'specialist_default'
  | 'company_default'
  | 'company_schedule';

export type EffectiveShift = {
  source: EffectiveShiftSource;
  shift: ShiftDto | null;
  workingSlots: number[];
  breakSlots: number[];
};

export type AvailabilitySlotReason =
  | 'outside_shift'
  | 'break'
  | 'busy'
  | 'not_enough_time';

export type AvailabilitySlot = {
  slot: number;
  available: boolean;
  reason?: AvailabilitySlotReason;
};

export type AvailabilityResult = {
  companyId: string;
  specialistId: string;
  date: string;
  shiftId: string | null;
  source: EffectiveShiftSource;
  workingSlots: number[];
  breakSlots: number[];
  busySlots: number[];
  availableSlots: number[];
  slots: AvailabilitySlot[];
};

export type ScheduleRangeDayDto = {
  date: string;
  source: EffectiveShiftSource;
  shiftId: string | null;
  shiftName: string | null;
  workingSlots: number[];
  breakSlots: number[];
  busySlots?: number[];
  availableSlots?: number[];
};

export type ScheduleRangeDto = {
  companyId: string;
  specialistId: string;
  start: string;
  end: string;
  days: ScheduleRangeDayDto[];
};

export type AssertSlotsAreBookableInput = {
  companyId: string;
  specialistId: string;
  date: string;
  slots: number[];
  excludeBookingId?: string;
};
