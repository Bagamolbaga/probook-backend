import type { CompanyPermission } from '../memberships/membership.service';
import type {
  CompanyRole,
  MembershipStatus,
} from '../memberships/schema/company-membership.schema';
import type { User } from '../user/schema/user.schema';

export type JwtPayload = {
  sub: string;
  email: string;
  tokenVersion: number;
};

export type AuthCompany = {
  id: string;
  name: string | null;
  roles: CompanyRole[];
  specialistProfileId: string | null;
  permissions: CompanyPermission[];
};

/**
 * @deprecated Use AuthCompany from user.companies for company selection.
 */
export type AuthMembership = {
  id: string;
  companyId: string;
  companyName: string | null;
  roles: CompanyRole[];
  status: MembershipStatus;
  specialistProfileId: string | null;
  permissions: CompanyPermission[];
};

export type AuthUser = User & {
  companies: AuthCompany[];
  /** @deprecated Use companies instead. */
  memberships: AuthMembership[];
};
