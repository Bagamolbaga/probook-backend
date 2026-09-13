import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { BookingStatus } from '../booking/schema/booking.schema';
import { NotificationGateway } from './notification.gateway';
import {
  BookingChange,
  BookingUpdatedEvent,
  CompanyDataType,
  CompanyDataUpdatedEvent,
} from './realtime.types';

@Injectable()
export class RealtimeService {
  constructor(private readonly gateway: NotificationGateway) {}

  publishBookingUpdated(input: {
    companyId: string;
    bookingId: string;
    changed: BookingChange[];
    status: BookingStatus;
    updatedAt?: Date;
  }): BookingUpdatedEvent {
    const event: BookingUpdatedEvent = {
      id: randomUUID(),
      companyId: input.companyId,
      bookingId: input.bookingId,
      changed: input.changed,
      status: input.status,
      occurredAt: new Date().toISOString(),
      updatedAt: input.updatedAt?.toISOString(),
    };

    this.gateway.sendToCompany(input.companyId, event);
    return event;
  }

  publishCompanyDataUpdated(
    companyId: string,
    entity: CompanyDataType,
  ): CompanyDataUpdatedEvent {
    const event: CompanyDataUpdatedEvent = {
      id: randomUUID(),
      companyId,
      entity,
      occurredAt: new Date().toISOString(),
    };

    this.gateway.sendCompanyDataUpdated(companyId, event);
    return event;
  }

  addUserToCompany(userId: string, companyId: string) {
    return this.gateway.addUserToCompany(userId, companyId);
  }
}
