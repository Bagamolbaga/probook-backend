import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import {
  CompanyMembership,
  CompanyRole,
  MembershipStatus,
} from './schema/company-membership.schema';

export enum CompanyPermission {
  COMPANY_MANAGE = 'company:manage',
  STAFF_MANAGE = 'staff:manage',
  BOOKINGS_READ_ALL = 'bookings:read:all',
  BOOKINGS_READ_SELF = 'bookings:read:self',
  BOOKINGS_CREATE_SELF = 'bookings:create:self',
  BOOKINGS_RESCHEDULE_SELF = 'bookings:reschedule:self',
  BOOKINGS_STATUS_SELF = 'bookings:update:self-status',
  CUSTOMERS_READ = 'customers:read',
  CUSTOMERS_READ_ASSIGNED = 'customers:read:assigned',
  CUSTOMERS_LOOKUP = 'customers:lookup',
  SCHEDULE_READ_SELF = 'schedule:read:self',
  SCHEDULE_MANAGE = 'schedule:manage',
  PROFILE_READ_SELF = 'profile:read:self',
  PROFILE_UPDATE_SELF = 'profile:update:self',
}

const ROLE_PERMISSIONS: Record<CompanyRole, CompanyPermission[]> = {
  [CompanyRole.OWNER]: Object.values(CompanyPermission),
  [CompanyRole.SPECIALIST]: [
    CompanyPermission.BOOKINGS_READ_SELF,
    CompanyPermission.BOOKINGS_CREATE_SELF,
    CompanyPermission.BOOKINGS_RESCHEDULE_SELF,
    CompanyPermission.BOOKINGS_STATUS_SELF,
    CompanyPermission.CUSTOMERS_READ_ASSIGNED,
    CompanyPermission.CUSTOMERS_LOOKUP,
    CompanyPermission.SCHEDULE_READ_SELF,
    CompanyPermission.PROFILE_READ_SELF,
    CompanyPermission.PROFILE_UPDATE_SELF,
  ],
};

@Injectable()
export class MembershipService {
  constructor(
    @InjectModel(CompanyMembership.name)
    private readonly membershipModel: Model<CompanyMembership>,
  ) {}

  upsertRole(
    userId: string | Types.ObjectId,
    companyId: string | Types.ObjectId,
    role: CompanyRole,
    session?: ClientSession,
  ) {
    return this.membershipModel.findOneAndUpdate(
      {
        userId: new Types.ObjectId(userId.toString()),
        companyId: new Types.ObjectId(companyId.toString()),
      },
      { $addToSet: { roles: role }, $set: { status: MembershipStatus.ACTIVE } },
      { new: true, upsert: true, setDefaultsOnInsert: true, session },
    );
  }

  findActive(
    userId: string | Types.ObjectId,
    companyId?: string | Types.ObjectId,
  ) {
    const filter: Record<string, unknown> = {
      userId: new Types.ObjectId(userId.toString()),
      status: MembershipStatus.ACTIVE,
    };
    if (companyId) filter.companyId = new Types.ObjectId(companyId.toString());
    return this.membershipModel
      .find(filter)
      .populate('companyId', 'name')
      .lean();
  }

  async hasPermission(
    userId: string,
    companyId: string,
    permission: CompanyPermission,
  ) {
    const membership = await this.membershipModel
      .findOne({
        userId: new Types.ObjectId(userId),
        companyId: new Types.ObjectId(companyId),
        status: MembershipStatus.ACTIVE,
      })
      .lean();
    return Boolean(
      membership?.roles.some((role) =>
        ROLE_PERMISSIONS[role].includes(permission),
      ),
    );
  }

  permissions(roles: CompanyRole[]) {
    return [...new Set(roles.flatMap((role) => ROLE_PERMISSIONS[role] || []))];
  }

  async deleteByCompany(companyId: string | Types.ObjectId): Promise<void> {
    await this.membershipModel.deleteMany({
      companyId: new Types.ObjectId(companyId.toString()),
    });
  }

  async deactivateSpecialist(
    userId: string | Types.ObjectId,
    companyId: string | Types.ObjectId,
  ): Promise<void> {
    const filter = {
      userId: new Types.ObjectId(userId.toString()),
      companyId: new Types.ObjectId(companyId.toString()),
    };
    const membership = await this.membershipModel.findOne(filter).lean();
    if (!membership?.roles.includes(CompanyRole.SPECIALIST)) return;

    if (membership.roles.includes(CompanyRole.OWNER)) {
      await this.membershipModel.updateOne(filter, {
        $pull: { roles: CompanyRole.SPECIALIST },
      });
      return;
    }

    await this.membershipModel.updateOne(filter, {
      $set: { status: MembershipStatus.SUSPENDED },
    });
  }
}
