export const NOTIFICATION_EVENT = 'notification';

export enum NotificationType {
  BOOKING_CREATED = 'booking.created',
}

export type BookingCreatedNotificationData = {
  bookingId: string;
  companyId: string;
  companyName: string;
  customerName: string;
  specialistName: string;
  serviceNames: string[];
  date: string;
  slots: number[];
  totalPrice: number;
  status: string;
};

export type NotificationDataMap = {
  [NotificationType.BOOKING_CREATED]: BookingCreatedNotificationData;
};

export type AppNotification<T extends NotificationType = NotificationType> = {
  id: string;
  type: T;
  occurredAt: string;
  data: NotificationDataMap[T];
};
