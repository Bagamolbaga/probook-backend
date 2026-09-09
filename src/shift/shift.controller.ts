import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ShiftService } from './shift.service';
import { Types } from 'mongoose';
import { SpecialistService } from 'src/specialists/specialist.service';
import { CreateShiftDto, UpdateShiftDto } from './dto/shift.dto';
import { ShiftKind } from './schema/shift.schema';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CompanyPermissionGuard } from '../memberships/company-permission.guard';
import { CompanyPermission } from '../memberships/membership.service';
import { RequireCompanyPermission } from '../memberships/require-company-permission.decorator';

@Controller('companies')
export class ShiftController {
  constructor(
    private shiftService: ShiftService,
    private specialistService: SpecialistService,
  ) {}

  @Get('/:companyId/shifts')
  async getCompanies(@Param('companyId') companyId: Types.ObjectId) {
    const user = await this.shiftService.getCompanyShifts({ companyId });
    return user;
  }

  @Get('/:companyId/specialists/shifts')
  async getSpecialistsShifts(
    @Param('companyId') companyId: Types.ObjectId,
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('date') date?: string,
  ) {
    const specialists = await this.specialistService.getSpecialists({
      companyId,
    });
    const shifts = await this.shiftService.getCompanyShifts({ companyId });

    const rangeStart = (start || date)?.slice(0, 10);
    const rangeEnd = (end || date || start)?.slice(0, 10);
    const results = specialists.map((specialist) => {
      const specialistId = specialist.id.toString();
      const overrides = shifts.filter(
        (shift) =>
          shift.kind === ShiftKind.OVERRIDE &&
          shift.specialistId === specialistId &&
          (!rangeStart || (shift.date && shift.date >= rangeStart)) &&
          (!rangeEnd || (shift.date && shift.date <= rangeEnd)),
      );
      const populatedDefaultShift = specialist.defaultShift as unknown as
        | { id?: string; _id?: Types.ObjectId }
        | Types.ObjectId
        | null
        | undefined;
      const defaultShiftId =
        populatedDefaultShift && 'id' in populatedDefaultShift
          ? populatedDefaultShift.id || populatedDefaultShift._id?.toString()
          : populatedDefaultShift?.toString();
      const defaultShift = defaultShiftId
        ? shifts.find(
            (shift) =>
              shift.id === defaultShiftId && shift.kind === ShiftKind.DEFAULT,
          )
        : undefined;

      return {
        specialist,
        shifts: overrides,
        defaultShift: defaultShift || null,
      };
    });

    return {
      count: results.length,
      next: null,
      previous: null,
      results: results,
    };
  }

  @Post('/:companyId/shifts')
  @UseGuards(JwtAuthGuard, CompanyPermissionGuard)
  @RequireCompanyPermission(CompanyPermission.SCHEDULE_MANAGE)
  async createCompany(
    @Param('companyId') companyId: Types.ObjectId,
    @Body() body: CreateShiftDto,
  ) {
    return this.shiftService.createShift(companyId, body);
  }

  @Put('/:companyId/shifts/:shiftId')
  @UseGuards(JwtAuthGuard, CompanyPermissionGuard)
  @RequireCompanyPermission(CompanyPermission.SCHEDULE_MANAGE)
  async addSpecialistToService(
    @Param('companyId') companyId: string,
    @Param('shiftId') shiftId: Types.ObjectId,
    @Body() body: UpdateShiftDto,
  ) {
    if (!companyId) {
      throw new NotFoundException('Company not found');
    }

    if (!shiftId) {
      throw new NotFoundException('Shift not found');
    }

    return this.shiftService.updateShiftById({
      id: shiftId,
      companyId,
      data: body,
    });
  }

  @Delete('/:companyId/shifts/:shiftId')
  @UseGuards(JwtAuthGuard, CompanyPermissionGuard)
  @RequireCompanyPermission(CompanyPermission.SCHEDULE_MANAGE)
  async deleteShift(
    @Param('companyId') companyId: string,
    @Param('shiftId') shiftId: Types.ObjectId,
  ) {
    if (!companyId) {
      throw new NotFoundException('Company not found');
    }

    if (!shiftId) {
      throw new NotFoundException('Shift not found');
    }

    return this.shiftService.deleteShiftBy({
      id: shiftId,
      companyId,
    });
  }
}
