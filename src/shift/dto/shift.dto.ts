import { ShiftKind } from '../schema/shift.schema';

export type ShiftDto = {
  id: string;
  companyId: string;
  specialistId: string | null;
  kind: ShiftKind;
  name: string;
  description?: string;
  color: string;
  date: string | null;
  workingSlots: number[];
  breakSlots: number[];
  createdAt?: string;
  updatedAt?: string;
};

export type CreateDefaultShiftDto = {
  name: string;
  description?: string;
  color?: string;
  workingSlots: number[];
  breakSlots?: number[];
};

export type CreateShiftOverrideDto = {
  specialistId: string;
  date: string;
  name?: string;
  description?: string;
  color?: string;
  workingSlots: number[];
  breakSlots?: number[];
};

export type CreateShiftDto = CreateDefaultShiftDto | CreateShiftOverrideDto;

export type UpdateShiftDto = Partial<{
  name: string;
  description: string;
  color: string;
  workingSlots: number[];
  breakSlots: number[];
}>;
