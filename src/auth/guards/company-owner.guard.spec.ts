import { ForbiddenException } from '@nestjs/common';
import { CompanyRole } from '../../memberships/schema/company-membership.schema';
import { CompanyOwnerGuard } from './company-owner.guard';

const context = {
  switchToHttp: () => ({
    getRequest: () => ({
      user: { _id: 'user-1' },
      params: { companyId: 'company-1' },
    }),
  }),
} as any;

describe('CompanyOwnerGuard', () => {
  it('allows an active owner membership', async () => {
    const memberships = {
      findActive: jest.fn().mockResolvedValue([{ roles: [CompanyRole.OWNER] }]),
    };
    await expect(
      new CompanyOwnerGuard(memberships as any).canActivate(context),
    ).resolves.toBe(true);
  });

  it('rejects a specialist-only membership', async () => {
    const memberships = {
      findActive: jest
        .fn()
        .mockResolvedValue([{ roles: [CompanyRole.SPECIALIST] }]),
    };
    await expect(
      new CompanyOwnerGuard(memberships as any).canActivate(context),
    ).rejects.toThrow(ForbiddenException);
  });
});
