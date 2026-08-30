import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '../../user/schema/user.schema';
import { CompanyOwnerGuard } from './company-owner.guard';

const createContext = ({
  user,
  companyId,
}: {
  user?: Record<string, unknown>;
  companyId?: string;
}) =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({
        user,
        params: { companyId },
      }),
    }),
  }) as any;

describe('CompanyOwnerGuard', () => {
  const guard = new CompanyOwnerGuard();

  it('allows an owner of the requested company', () => {
    expect(
      guard.canActivate(
        createContext({
          companyId: 'company-1',
          user: {
            role: UserRole.OWNER,
            company: { _id: 'company-1' },
          },
        }),
      ),
    ).toBe(true);
  });

  it('rejects owners of another company', () => {
    expect(() =>
      guard.canActivate(
        createContext({
          companyId: 'company-2',
          user: {
            role: UserRole.OWNER,
            company: 'company-1',
          },
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('rejects non-owner users', () => {
    expect(() =>
      guard.canActivate(
        createContext({
          companyId: 'company-1',
          user: {
            role: UserRole.MANAGER,
            company: 'company-1',
          },
        }),
      ),
    ).toThrow(ForbiddenException);
  });
});
