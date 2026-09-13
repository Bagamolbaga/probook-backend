import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { Company, CompanySchema } from '../companies/schema/company.schema';
import { EmailModule } from '../email/email.module';
import { SpecialistModule } from '../specialists/specialist.module';
import { NotificationModule } from '../notification/notification.module';
import { UserModule } from '../user/user.module';
import {
  CompanyInvitation,
  CompanyInvitationSchema,
} from './schema/company-invitation.schema';
import {
  CompanyInvitationController,
  InvitationAuthController,
  InvitationController,
} from './invitation.controller';
import { InvitationService } from './invitation.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CompanyInvitation.name, schema: CompanyInvitationSchema },
      { name: Company.name, schema: CompanySchema },
    ]),
    UserModule,
    SpecialistModule,
    EmailModule,
    AuthModule,
    NotificationModule,
  ],
  controllers: [
    InvitationController,
    CompanyInvitationController,
    InvitationAuthController,
  ],
  providers: [InvitationService],
  exports: [InvitationService],
})
export class InvitationModule {}
