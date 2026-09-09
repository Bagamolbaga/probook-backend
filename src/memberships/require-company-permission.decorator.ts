import { SetMetadata } from '@nestjs/common';
import { CompanyPermission } from './membership.service';

export const COMPANY_PERMISSION = 'companyPermission';
export const RequireCompanyPermission = (...permissions: CompanyPermission[]) =>
  SetMetadata(COMPANY_PERMISSION, permissions);
