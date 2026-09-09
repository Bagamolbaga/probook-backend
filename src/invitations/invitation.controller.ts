import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthService } from '../auth/auth.service';
import { CompanyPermissionGuard } from '../memberships/company-permission.guard';
import { CompanyPermission } from '../memberships/membership.service';
import { RequireCompanyPermission } from '../memberships/require-company-permission.decorator';
import { User } from '../user/schema/user.schema';
import {
  CreateInvitationDto,
  RegisterInvitationPasswordDto,
} from './dto/invitation.dto';
import { InvitationService } from './invitation.service';

@Controller('invitations')
export class InvitationController {
  constructor(private readonly invitations: InvitationService) {}

  @Get(':token') preview(@Param('token') token: string) {
    return this.invitations.preview(token);
  }

  @Post(':token/accept')
  @UseGuards(JwtAuthGuard)
  accept(@Param('token') token: string, @CurrentUser() user: User) {
    return this.invitations.accept(token, user._id.toString());
  }
}

@Controller('companies/:companyId/invitations')
@UseGuards(JwtAuthGuard, CompanyPermissionGuard)
@RequireCompanyPermission(CompanyPermission.STAFF_MANAGE)
export class CompanyInvitationController {
  constructor(private readonly invitations: InvitationService) {}
  @Get()
  async list(@Param('companyId') companyId: string) {
    const results = await this.invitations.list(companyId);
    return { count: results.length, next: null, previous: null, results };
  }
  @Post() create(
    @Param('companyId') companyId: string,
    @CurrentUser() user: User,
    @Body() body: CreateInvitationDto,
  ) {
    return this.invitations.create(companyId, user._id.toString(), body);
  }
  @Post(':invitationId/resend') resend(
    @Param('companyId') companyId: string,
    @Param('invitationId') invitationId: string,
  ) {
    return this.invitations.resend(companyId, invitationId);
  }
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':invitationId')
  async revoke(
    @Param('companyId') companyId: string,
    @Param('invitationId') invitationId: string,
  ) {
    await this.invitations.revoke(companyId, invitationId);
  }
}

@Controller('auth/invitations')
export class InvitationAuthController {
  constructor(
    private readonly invitations: InvitationService,
    private readonly auth: AuthService,
  ) {}
  @Post(':token/register-password')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async register(
    @Param('token') token: string,
    @Body() body: RegisterInvitationPasswordDto,
  ) {
    const user = await this.invitations.registerPassword(token, body.password);
    return this.auth.issueTokensForUser(user);
  }
}
