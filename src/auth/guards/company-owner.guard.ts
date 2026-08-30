import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { UserRole } from '../../user/schema/user.schema';

@Injectable()
export class CompanyOwnerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const companyId = request.params?.companyId;

    if (!user || user.role !== UserRole.OWNER) {
      throw new ForbiddenException(
        'Only company owner can perform this action',
      );
    }

    if (!companyId) {
      return true;
    }

    const userCompanyId = this.getId(user.company);

    if (userCompanyId !== companyId.toString()) {
      throw new ForbiddenException(
        'Only company owner can perform this action',
      );
    }

    return true;
  }

  private getId(value: unknown) {
    if (!value) {
      return null;
    }

    if (
      typeof value === 'object' &&
      'toHexString' in value &&
      typeof (value as { toHexString: unknown }).toHexString === 'function'
    ) {
      return (value as { toHexString: () => string }).toHexString();
    }

    if (typeof value === 'object' && '_id' in value) {
      return this.getId((value as { _id: unknown })._id);
    }

    return value.toString();
  }
}
