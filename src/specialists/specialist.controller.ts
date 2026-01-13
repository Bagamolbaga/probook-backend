import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { CreateSpecialistDto, SpecialistService } from './specialist.service';
import { Types } from 'mongoose';

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
  async createSpecialist(
    @Param('companyId') companyId: Types.ObjectId,
    @Body() body: CreateSpecialistDto,
  ) {
    try {
      const newUser = await this.specialistService.createSpecialist({
        company: companyId,
        ...body,
      });

      return newUser;
    } catch (error) {
      console.log(error);
    }
  }
}
