import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { MembershipService } from '../../memberships/membership.service';
import { CompanyRole } from '../../memberships/schema/company-membership.schema';
import { SpecialistService } from '../../specialists/specialist.service';

@Injectable()
export class SpecialistSelfOrOwnerGuard implements CanActivate {
  constructor(
    private memberships: MembershipService,
    private specialists: SpecialistService,
  ) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const { companyId, specialistId } = request.params;
    const membership = (
      await this.memberships.findActive(request.user?._id, companyId)
    )[0];
    if (membership?.roles.includes(CompanyRole.OWNER)) return true;
    const profile = await this.specialists.getSpecialistBy({
      userId: request.user?._id,
      companyId,
    });
    if (!profile || profile._id.toString() !== specialistId)
      throw new ForbiddenException('Only own schedule can be viewed');
    return true;
  }
}
