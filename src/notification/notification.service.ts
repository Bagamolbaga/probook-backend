import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Types } from 'mongoose';
import { NotificationGateway } from './notification.gateway';
import {
  AppNotification,
  NotificationDataMap,
  NotificationType,
} from './notification.types';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private readonly gateway: NotificationGateway) {}

  notifyUser<T extends NotificationType>(
    userId: Types.ObjectId | string,
    type: T,
    data: NotificationDataMap[T],
  ): AppNotification<T> {
    const notification: AppNotification<T> = {
      id: randomUUID(),
      type,
      occurredAt: new Date().toISOString(),
      data,
    };

    try {
      this.gateway.sendToUser(userId.toString(), notification);
    } catch (error) {
      this.logger.error(
        `Failed to send ${type} notification to user ${userId.toString()}`,
        error instanceof Error ? error.stack : undefined,
      );
    }

    return notification;
  }
}
