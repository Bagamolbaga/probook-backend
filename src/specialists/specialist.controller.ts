import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  CreateSpecialistDto,
  SpecialistService,
  UpdateSpecialistDto,
} from './specialist.service';
import { Types } from 'mongoose';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CompanyOwnerGuard } from '../auth/guards/company-owner.guard';

@Controller('companies')
export class SpecialistController {
  constructor(private specialistService: SpecialistService) {}

  @Get('/:companyId/specialists')
  async getSpecialistBy(@Param('companyId') companyId: Types.ObjectId) {
    const specialists = await this.specialistService.getSpecialists({
      companyId,
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

  @Post('/:companyId/specialists')
  @UseGuards(JwtAuthGuard, CompanyOwnerGuard)
  async createSpecialist(
    @Param('companyId') companyId: Types.ObjectId,
    @Body() body: CreateSpecialistDto,
  ) {
    const newUser = await this.specialistService.createSpecialist({
      company: companyId,
      ...body,
    });

    return newUser;
  }

  @Put('/:companyId/specialists/:specialistId')
  @UseGuards(JwtAuthGuard, CompanyOwnerGuard)
  async updateSpecialist(
    @Param('companyId') companyId: Types.ObjectId,
    @Param('specialistId') specialistId: Types.ObjectId,
    @Body() body: UpdateSpecialistDto,
  ) {
    return this.specialistService.updateSpecialistBy(
      { id: specialistId, companyId },
      body,
    );
  }

  @Delete('/:companyId/specialists/:specialistId')
  @UseGuards(JwtAuthGuard, CompanyOwnerGuard)
  async deleteSpecialist(
    @Param('companyId') companyId: Types.ObjectId,
    @Param('specialistId') specialistId: Types.ObjectId,
  ) {
    return this.specialistService.deleteSpecialistBy({
      id: specialistId,
      companyId,
    });
  }
}
