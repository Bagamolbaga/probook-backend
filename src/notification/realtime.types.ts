import { BookingStatus } from '../booking/schema/booking.schema';

export const BOOKING_UPDATED_EVENT = 'booking:updated';

export const COMPANY_DATA_UPDATED_EVENT = 'company:data-updated';

export type BookingChange = 'created' | 'status' | 'schedule' | 'details';

export type BookingUpdatedEvent = {
  id: string;
  companyId: string;
  bookingId: string;
  changed: BookingChange[];
  status: BookingStatus;
  occurredAt: string;
  updatedAt?: string;
};

export type CompanyDataType = 'specialists' | 'shifts' | 'services';

export type CompanyDataUpdatedEvent = {
  id: string;
  companyId: string;
  entity: CompanyDataType;
  occurredAt: string;
};
