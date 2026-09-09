import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { MembershipService } from '../../memberships/membership.service';
import { CompanyRole } from '../../memberships/schema/company-membership.schema';

/** @deprecated Prefer CompanyPermissionGuard. */
@Injectable()
export class CompanyOwnerGuard implements CanActivate {
  constructor(private readonly memberships: MembershipService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const companyId = request.params?.companyId;
    if (!request.user?._id || !companyId)
      throw new ForbiddenException('Active owner membership required');
    const membership = (
      await this.memberships.findActive(request.user._id, companyId)
    )[0];
    if (!membership?.roles.includes(CompanyRole.OWNER))
      throw new ForbiddenException('Active owner membership required');
    return true;
  }
}
