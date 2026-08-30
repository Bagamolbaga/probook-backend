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
  Request,
} from '@nestjs/common';
import { ShiftService } from './shift.service';
import { Types } from 'mongoose';
import { SpecialistService } from 'src/specialists/specialist.service';
import { CreateShiftDto, UpdateShiftDto } from './dto/shift.dto';
import { ShiftKind } from './schema/shift.schema';

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

  @Get()
  async getCompanyBy(@Request() req) {
    const { id } = req.query;
    if (id) {
      const user = await this.shiftService.getShiftBy({ id });

      if (!user) {
        throw new NotFoundException('Company not found');
      }

      return user;
    }
  }

  @Post('/:companyId/shifts')
  async createCompany(
    @Param('companyId') companyId: Types.ObjectId,
    @Body() body: CreateShiftDto,
  ) {
    try {
      const newCompany = await this.shiftService.createShift(companyId, body);

      return newCompany;
    } catch (error) {
      console.log(error);
    }
  }

  @Put('/:companyId/shifts/:shiftId')
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

    try {
      const service = await this.shiftService.updateShiftById({
        id: shiftId,
        data: body,
      });

      return service;
    } catch (error) {
      console.log(error);
    }
  }

  @Delete('/:companyId/shifts/:shiftId')
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

    try {
      const deletedShift = await this.shiftService.deleteShiftBy({
        id: shiftId,
      });

      return deletedShift;
    } catch (error) {
      console.log(error);
    }
  }
}
