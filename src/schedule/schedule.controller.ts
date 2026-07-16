import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Query } from '@nestjs/common';
import { AvailabilityService } from 'src/availability/availability.service';
import { CreateScheduleDto, UpdateScheduleDto } from './dto/schedule.dto';
import { ScheduleService } from './schedule.service';

@Controller('companies')
export class ScheduleController {
  constructor(
    private scheduleService: ScheduleService,
    private availabilityService: AvailabilityService,
  ) {}

  @Get('/:companyId/schedules')
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
  async getScheduleById(
    @Param('companyId') companyId: string,
    @Param('scheduleId') scheduleId: string,
  ) {
    return this.scheduleService.getScheduleById(companyId, scheduleId);
  }

  @Post('/:companyId/schedules')
  async createSchedule(
    @Param('companyId') companyId: string,
    @Body() body: CreateScheduleDto,
  ) {
    return this.scheduleService.createSchedule(companyId, body);
  }

  @Patch('/:companyId/schedules/:scheduleId')
  async updateSchedule(
    @Param('companyId') companyId: string,
    @Param('scheduleId') scheduleId: string,
    @Body() body: UpdateScheduleDto,
  ) {
    return this.scheduleService.updateSchedule(companyId, scheduleId, body);
  }

  @Delete('/:companyId/schedules/:scheduleId')
  async deleteSchedule(
    @Param('companyId') companyId: string,
    @Param('scheduleId') scheduleId: string,
  ) {
    return this.scheduleService.deleteSchedule(companyId, scheduleId);
  }
}
