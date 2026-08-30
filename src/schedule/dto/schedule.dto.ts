import { ScheduleType } from '../schema/schedule.schema';

export type ScheduleDayDto = {
  day: number;
  shiftId: string | null;
};

export type ScheduleDto = {
  id: string;
  companyId: string;
  specialistId: string;
  type: ScheduleType;
  activeFrom: string;
  activeTo: string | null;
  cycleLengthDays?: number;
  days: ScheduleDayDto[];
  createdAt?: string;
  updatedAt?: string;
};

export type CreateScheduleDto = {
  specialistId: string;
  type?: ScheduleType;
  activeFrom: string;
  activeTo?: string | null;
  cycleLengthDays?: number;
  days: ScheduleDayDto[];
};

export type UpdateScheduleDto = Partial<{
  activeFrom: string;
  activeTo: string | null;
  cycleLengthDays: number;
  days: ScheduleDayDto[];
}>;
