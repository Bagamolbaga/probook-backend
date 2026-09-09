import { ForbiddenException } from '@nestjs/common';
import { CompanyPermissionGuard } from './company-permission.guard';
import { CompanyPermission } from './membership.service';

describe('CompanyPermissionGuard', () => {
  const context = {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({
        user: { _id: '507f1f77bcf86cd799439011' },
        params: { companyId: '507f191e810c19729de860ea' },
      }),
    }),
  } as any;

  it('allows access when the membership has any required permission', async () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValue([
          CompanyPermission.CUSTOMERS_READ,
          CompanyPermission.CUSTOMERS_READ_ASSIGNED,
        ]),
    };
    const memberships = {
      hasPermission: jest
        .fn()
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true),
    };
    const guard = new CompanyPermissionGuard(
      reflector as any,
      memberships as any,
    );

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(memberships.hasPermission).toHaveBeenCalledTimes(2);
  });

  it('rejects access when the membership has none of the required permissions', async () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValue([
          CompanyPermission.CUSTOMERS_READ,
          CompanyPermission.CUSTOMERS_READ_ASSIGNED,
        ]),
    };
    const memberships = { hasPermission: jest.fn().mockResolvedValue(false) };
    const guard = new CompanyPermissionGuard(
      reflector as any,
      memberships as any,
    );

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
