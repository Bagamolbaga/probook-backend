import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Put,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { SpecialistService } from './specialist.service';
import { Types } from 'mongoose';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CompanyPermissionGuard } from '../memberships/company-permission.guard';
import { RequireCompanyPermission } from '../memberships/require-company-permission.decorator';
import { CompanyPermission } from '../memberships/membership.service';
import { MembershipService } from '../memberships/membership.service';
import { CompanyRole } from '../memberships/schema/company-membership.schema';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../user/schema/user.schema';
import {
  UpdateSpecialistByOwnerDto,
  UpdateSpecialistProfileDto,
} from './dto/specialist-profile.dto';
import { RealtimeService } from '../notification/realtime.service';

@Controller('companies')
export class SpecialistController {
  constructor(
    private specialistService: SpecialistService,
    private membershipService: MembershipService,
    private realtimeService: RealtimeService,
  ) {}

  @Get('/:companyId/specialists')
  @UseGuards(OptionalJwtAuthGuard)
  async getSpecialistBy(
    @Param('companyId') companyId: Types.ObjectId,
    @CurrentUser() user?: User,
  ) {
    const membership = user
      ? (await this.membershipService.findActive(user._id, companyId))[0]
      : null;
    const specialists = await this.specialistService.getSpecialists({
      companyId,
      includeEmail: Boolean(membership?.roles.includes(CompanyRole.OWNER)),
    });

    if (!specialists) {
      throw new NotFoundException('User not found');
    }

    return {
      count: specialists.length,
      next: null,
      previous: null,
      results: specialists,
    };
  }

  @Put('/:companyId/me/specialist-profile')
  @UseGuards(JwtAuthGuard, CompanyPermissionGuard)
  @RequireCompanyPermission(CompanyPermission.STAFF_MANAGE)
  async enableOwnerSpecialistProfile(
    @Param('companyId') companyId: Types.ObjectId,
    @CurrentUser() user: User,
    @Body() body: UpdateSpecialistProfileDto,
  ) {
    await this.membershipService.upsertRole(
      user._id,
      companyId,
      CompanyRole.SPECIALIST,
    );
    const profile = await this.specialistService.createSpecialist({
      userId: user._id,
      company: companyId,
      specialties: body.specialties,
      bio: body.bio,
      services: body.serviceIds?.map((id) => new Types.ObjectId(id)),
      defaultShift: body.defaultShiftId
        ? new Types.ObjectId(body.defaultShiftId)
        : undefined,
    });
    this.realtimeService.publishCompanyDataUpdated(
      companyId.toString(),
      'specialists',
    );

    return profile;
  }

  @Get('/:companyId/my/specialist-profile')
  @UseGuards(JwtAuthGuard, CompanyPermissionGuard)
  @RequireCompanyPermission(CompanyPermission.PROFILE_READ_SELF)
  async getMySpecialistProfile(
    @Param('companyId') companyId: Types.ObjectId,
    @CurrentUser() user: User,
  ) {
    const profile = await this.specialistService.getSpecialistBy({
      userId: user._id,
      companyId,
    });
    if (!profile?.active) {
      throw new ForbiddenException('Active specialist profile required');
    }
    return profile;
  }

  @Patch('/:companyId/my/specialist-profile')
  @UseGuards(JwtAuthGuard, CompanyPermissionGuard)
  @RequireCompanyPermission(CompanyPermission.PROFILE_UPDATE_SELF)
  async updateMySpecialistProfile(
    @Param('companyId') companyId: Types.ObjectId,
    @CurrentUser() user: User,
    @Body() body: UpdateSpecialistProfileDto,
  ) {
    const profile = await this.specialistService.getSpecialistBy({
      userId: user._id,
      companyId,
    });
    if (!profile?.active) {
      throw new ForbiddenException('Active specialist profile required');
    }
    const updatedProfile = await this.specialistService.updateSpecialistBy(
      { id: profile._id, companyId },
      {
        specialties: body.specialties,
        bio: body.bio,
        services: body.serviceIds?.map((id) => new Types.ObjectId(id)),
        defaultShift: body.defaultShiftId
          ? new Types.ObjectId(body.defaultShiftId)
          : undefined,
      },
    );
    this.realtimeService.publishCompanyDataUpdated(
      companyId.toString(),
      'specialists',
    );

    return updatedProfile;
  }

  @Put('/:companyId/specialists/:specialistId')
  @UseGuards(JwtAuthGuard, CompanyPermissionGuard)
  @RequireCompanyPermission(CompanyPermission.STAFF_MANAGE)
  async updateSpecialist(
    @Param('companyId') companyId: Types.ObjectId,
    @Param('specialistId') specialistId: Types.ObjectId,
    @Body() body: UpdateSpecialistByOwnerDto,
  ) {
    const specialist = await this.specialistService.updateSpecialistBy(
      { id: specialistId, companyId },
      {
        specialties: body.specialties,
        bio: body.bio,
        services: body.serviceIds?.map((id) => new Types.ObjectId(id)),
        defaultShift: body.defaultShiftId
          ? new Types.ObjectId(body.defaultShiftId)
          : undefined,
        active: body.active,
      },
    );
    this.realtimeService.publishCompanyDataUpdated(
      companyId.toString(),
      'specialists',
    );

    return specialist;
  }

  @Delete('/:companyId/specialists/:specialistId')
  @UseGuards(JwtAuthGuard, CompanyPermissionGuard)
  @RequireCompanyPermission(CompanyPermission.STAFF_MANAGE)
  async deleteSpecialist(
    @Param('companyId') companyId: Types.ObjectId,
    @Param('specialistId') specialistId: Types.ObjectId,
  ) {
    const specialist = await this.specialistService.deleteSpecialistBy({
      id: specialistId,
      companyId,
    });
    const specialistUserId =
      specialist.userId instanceof Types.ObjectId
        ? specialist.userId
        : specialist.userId._id;
    await this.membershipService.deactivateSpecialist(
      specialistUserId,
      companyId,
    );
    this.realtimeService.publishCompanyDataUpdated(
      companyId.toString(),
      'specialists',
    );
    return specialist;
  }
}
