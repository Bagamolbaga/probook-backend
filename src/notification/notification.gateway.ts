import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { UserService } from '../user/user.service';
import { JwtPayload } from '../auth/types';
import { getAllowedOrigins } from '../config';
import { AppNotification, NOTIFICATION_EVENT } from './notification.types';

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
      await client.join(this.getUserRoom(client.data.userId));
    } catch (_error: any) {
      client.emit('notification.error', { code: 'UNAUTHORIZED' });
      client.disconnect(true);
    }
  }

  sendToUser(userId: string, notification: AppNotification) {
    this.server
      .to(this.getUserRoom(userId))
      .emit(NOTIFICATION_EVENT, notification);
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
}
