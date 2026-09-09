import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  CompanyMembership,
  CompanyMembershipSchema,
} from './schema/company-membership.schema';
import { MembershipService } from './membership.service';
import { CompanyPermissionGuard } from './company-permission.guard';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CompanyMembership.name, schema: CompanyMembershipSchema },
    ]),
  ],
  providers: [MembershipService, CompanyPermissionGuard],
  exports: [MembershipService, CompanyPermissionGuard, MongooseModule],
})
export class MembershipModule {}
