import { UserRole } from '../user/schema/user.schema';

export type JwtPayload = {
  sub: string;
  email: string;
  role: UserRole;
  companyId: string | null;
  tokenVersion: number;
};
