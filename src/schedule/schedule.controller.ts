import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Query } from '@nestjs/common';
import { AvailabilityService } from 'src/availability/availability.service';
import { CreateScheduleDto, UpdateScheduleDto } from './dto/schedule.dto';
import { ScheduleService } from './schedule.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CompanyPermissionGuard } from '../memberships/company-permission.guard';
import { CompanyPermission } from '../memberships/membership.service';
import { RequireCompanyPermission } from '../memberships/require-company-permission.decorator';
import { SpecialistSelfOrOwnerGuard } from '../auth/guards/specialist-self-or-owner.guard';

@Controller('companies')
export class ScheduleController {
  constructor(
    private scheduleService: ScheduleService,
    private availabilityService: AvailabilityService,
  ) {}

  @Get('/:companyId/schedules')
  @UseGuards(JwtAuthGuard, CompanyPermissionGuard)
  @RequireCompanyPermission(CompanyPermission.SCHEDULE_MANAGE)
  async getCompanySchedules(@Param('companyId') companyId: string) {
    const schedules = await this.scheduleService.getCompanySchedules(companyId);
    return {
      count: schedules.length,
      next: null,
      previous: null,
      results: schedules,
    };
  }

  @Get('/:companyId/specialists/:specialistId/schedules')
  @UseGuards(JwtAuthGuard, SpecialistSelfOrOwnerGuard)
  async getSpecialistSchedules(
    @Param('companyId') companyId: string,
    @Param('specialistId') specialistId: string,
  ) {
    const schedules = await this.scheduleService.getSpecialistSchedules(
      companyId,
      specialistId,
    );
    return {
      count: schedules.length,
      next: null,
      previous: null,
      results: schedules,
    };
  }

  @Get('/:companyId/specialists/:specialistId/schedule')
  async getSpecialistScheduleRange(
    @Param('companyId') companyId: string,
    @Param('specialistId') specialistId: string,
    @Query('start') start: string,
    @Query('end') end: string,
    @Query('includeAvailability') includeAvailability?: string,
  ) {
    return this.availabilityService.getScheduleRange({
      companyId,
      specialistId,
      start,
      end,
      includeAvailability: includeAvailability === 'true',
    });
  }

  @Get('/:companyId/schedules/:scheduleId')
  @UseGuards(JwtAuthGuard, CompanyPermissionGuard)
  @RequireCompanyPermission(CompanyPermission.SCHEDULE_MANAGE)
  async getScheduleById(
    @Param('companyId') companyId: string,
    @Param('scheduleId') scheduleId: string,
  ) {
    return this.scheduleService.getScheduleById(companyId, scheduleId);
  }

  @Post('/:companyId/schedules')
  @UseGuards(JwtAuthGuard, CompanyPermissionGuard)
  @RequireCompanyPermission(CompanyPermission.SCHEDULE_MANAGE)
  async createSchedule(
    @Param('companyId') companyId: string,
    @Body() body: CreateScheduleDto,
  ) {
    return this.scheduleService.createSchedule(companyId, body);
  }

  @Patch('/:companyId/schedules/:scheduleId')
  @UseGuards(JwtAuthGuard, CompanyPermissionGuard)
  @RequireCompanyPermission(CompanyPermission.SCHEDULE_MANAGE)
  async updateSchedule(
    @Param('companyId') companyId: string,
    @Param('scheduleId') scheduleId: string,
    @Body() body: UpdateScheduleDto,
  ) {
    return this.scheduleService.updateSchedule(companyId, scheduleId, body);
  }

  @Delete('/:companyId/schedules/:scheduleId')
  @UseGuards(JwtAuthGuard, CompanyPermissionGuard)
  @RequireCompanyPermission(CompanyPermission.SCHEDULE_MANAGE)
  async deleteSchedule(
    @Param('companyId') companyId: string,
    @Param('scheduleId') scheduleId: string,
  ) {
    return this.scheduleService.deleteSchedule(companyId, scheduleId);
  }
}
