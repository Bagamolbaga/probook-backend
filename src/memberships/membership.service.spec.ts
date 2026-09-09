import { CompanyPermission, MembershipService } from './membership.service';
import { CompanyRole } from './schema/company-membership.schema';

describe('MembershipService permissions', () => {
  const service = new MembershipService({} as never);

  it('keeps a specialist scoped to their own operational data', () => {
    const permissions = service.permissions([CompanyRole.SPECIALIST]);

    expect(permissions).toEqual(
      expect.arrayContaining([
        CompanyPermission.BOOKINGS_READ_SELF,
        CompanyPermission.BOOKINGS_CREATE_SELF,
        CompanyPermission.BOOKINGS_RESCHEDULE_SELF,
        CompanyPermission.BOOKINGS_STATUS_SELF,
        CompanyPermission.CUSTOMERS_READ_ASSIGNED,
        CompanyPermission.SCHEDULE_READ_SELF,
        CompanyPermission.PROFILE_READ_SELF,
        CompanyPermission.PROFILE_UPDATE_SELF,
      ]),
    );
    expect(permissions).not.toContain(CompanyPermission.COMPANY_MANAGE);
    expect(permissions).not.toContain(CompanyPermission.STAFF_MANAGE);
    expect(permissions).not.toContain(CompanyPermission.SCHEDULE_MANAGE);
    expect(permissions).not.toContain(CompanyPermission.BOOKINGS_READ_ALL);
  });

  it('gives an owner every company permission without duplicates', () => {
    const permissions = service.permissions([
      CompanyRole.OWNER,
      CompanyRole.SPECIALIST,
    ]);

    expect(permissions).toEqual(
      expect.arrayContaining(Object.values(CompanyPermission)),
    );
    expect(new Set(permissions).size).toBe(permissions.length);
  });
});
