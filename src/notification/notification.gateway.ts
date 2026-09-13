import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { MembershipService } from '../memberships/membership.service';
import { UserService } from '../user/user.service';
import { JwtPayload } from '../auth/types';
import { getAllowedOrigins } from '../config';
import { AppNotification, NOTIFICATION_EVENT } from './notification.types';
import {
  BOOKING_UPDATED_EVENT,
  COMPANY_DATA_UPDATED_EVENT,
  BookingUpdatedEvent,
  CompanyDataUpdatedEvent,
} from './realtime.types';

@WebSocketGateway({
  namespace: '/notifications',
  cors: {
    origin: getAllowedOrigins(),
    credentials: true,
  },
})
export class NotificationGateway implements OnGatewayConnection {
  @WebSocketServer()
  private server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly userService: UserService,
    private readonly memberships: MembershipService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = this.getAccessToken(client);
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      const user = await this.userService.getUserBy({ id: payload.sub });

      if (!user || user.tokenVersion !== payload.tokenVersion) {
        throw new Error('Invalid token');
      }

      client.data.userId = user._id.toString();
      const memberships = await this.memberships.findActive(client.data.userId);
      await client.join([
        this.getUserRoom(client.data.userId),
        ...memberships.map((membership) =>
          this.getCompanyRoom(membership.companyId._id.toString()),
        ),
      ]);

      client.emit('socket.ready', {
        userId: client.data.userId,
        companyIds: memberships.map((membership) =>
          membership.companyId._id.toString(),
        ),
      });

      console.log(
        `user ${user._id} join ${this.getUserRoom(client.data.userId)} ${memberships.map((membership) => this.getCompanyRoom(membership.companyId._id.toString())).join(' ')}`,
      );
    } catch (_error: any) {
      client.emit('notification.error', { code: 'UNAUTHORIZED' });
      client.disconnect(true);
    }
  }

  sendToUser(userId: string, notification: AppNotification) {
    this.server
      .to(this.getUserRoom(userId))
      .emit(NOTIFICATION_EVENT, notification);

    console.log(`socket send to: ${this.getUserRoom(userId)}`);
  }

  sendToCompany(companyId: string, event: BookingUpdatedEvent) {
    this.server
      .to(this.getCompanyRoom(companyId))
      .emit(BOOKING_UPDATED_EVENT, event);

    console.log(`socket send to: ${this.getCompanyRoom(companyId)}`);
  }

  sendCompanyDataUpdated(companyId: string, event: CompanyDataUpdatedEvent) {
    this.server
      .to(this.getCompanyRoom(companyId))
      .emit(COMPANY_DATA_UPDATED_EVENT, event);

    console.log(`socket send to: ${this.getCompanyRoom(companyId)}`);
  }

  async addUserToCompany(userId: string, companyId: string) {
    const room = this.getCompanyRoom(companyId);
    const sockets = await this.server
      .in(this.getUserRoom(userId))
      .fetchSockets();
    await Promise.all(sockets.map((socket) => socket.join(room)));
  }

  private getAccessToken(client: Socket) {
    const authToken = client.handshake.auth?.token;
    const authorization = client.handshake.headers.authorization;
    const bearerToken = authorization?.startsWith('Bearer ')
      ? authorization.slice(7)
      : undefined;
    const token = authToken || bearerToken;

    if (!token || typeof token !== 'string') {
      throw new Error('Access token is required');
    }

    return token;
  }

  private getUserRoom(userId: string) {
    return `user:${userId}`;
  }

  private getCompanyRoom(companyId: string) {
    return `company:${companyId}`;
  }
}
