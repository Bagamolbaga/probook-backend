import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { UserModule } from '../user/user.module';
import { NotificationGateway } from './notification.gateway';
import { NotificationService } from './notification.service';
import { RealtimeService } from './realtime.service';

@Module({
  imports: [
    ConfigModule,
    UserModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('auth.secret'),
      }),
    }),
  ],
  providers: [NotificationGateway, NotificationService, RealtimeService],
  exports: [NotificationService, RealtimeService],
})
export class NotificationModule {}
