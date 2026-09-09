import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { COMPANY_PERMISSION } from './require-company-permission.decorator';
import { CompanyPermission, MembershipService } from './membership.service';

@Injectable()
export class CompanyPermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private memberships: MembershipService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const permissions = this.reflector.getAllAndOverride<CompanyPermission[]>(
      COMPANY_PERMISSION,
      [context.getHandler(), context.getClass()],
    );
    if (!permissions?.length) return true;
    const request = context.switchToHttp().getRequest();
    const companyId = request.params?.companyId;
    if (
      !request.user?._id ||
      !companyId ||
      !(
        await Promise.all(
          permissions.map((permission) =>
            this.memberships.hasPermission(
              request.user._id.toString(),
              companyId,
              permission,
            ),
          ),
        )
      ).some(Boolean)
    ) {
      throw new ForbiddenException('Insufficient company permission');
    }
    return true;
  }
}
