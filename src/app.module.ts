import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import config from './config';
import { CompanyModule } from './companies/companies.module';
import { ServiceModule } from './services/services.module';
import { SpecialistModule } from './specialists/specialist.module';
import { ShiftModule } from './shift/shift.module';
import { BookingModule } from './booking/booking.module';
import { ScheduleModule } from './schedule/schedule.module';
import { AuthModule } from './auth/auth.module';
import { ServiceCategoriesModule } from './service-categories/service-categories.module';
import { NotificationModule } from './notification/notification.module';
import { MembershipModule } from './memberships/membership.module';
import { InvitationModule } from './invitations/invitation.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
      load: [config],
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get('db.url'),
      }),
    }),
    MembershipModule,
    UserModule,
    ServiceModule,
    SpecialistModule,
    ShiftModule,
    ScheduleModule,
    BookingModule,
    CompanyModule,
    AuthModule,
    ServiceCategoriesModule,
    NotificationModule,
    InvitationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
