import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Request,
} from '@nestjs/common';
import { CreateServiceDto, ServiceService } from './services.service';
import { Types } from 'mongoose';
import { Service } from './schema/services.schema';

@Controller('companies')
export class ServiceController {
  constructor(private servicesService: ServiceService) {}

  @Get('/:companyId/services')
  async getCompanies(@Param('companyId') companyId: string) {
    const services = await this.servicesService.getCompanyServices({
      companyId,
    });

    return {
      count: services.length,
      next: null,
      previous: null,
      results: services,
    };
  }

  @Get()
  async getCompanyBy(@Request() req) {
    const { id } = req.query;
    if (id) {
      const user = await this.servicesService.getServiceBy({ id });

      if (!user) {
        throw new NotFoundException('Company not found');
      }

      return user;
    }
  }

  @Post('/:companyId/services')
  async createCompany(
    @Param('companyId') companyId: Types.ObjectId,
    @Body() body: CreateServiceDto,
  ) {
    try {
      const newCompany = await this.servicesService.createService({
        companyId,
        ...body,
      });

      //TODO set `company` field to user.company

      return newCompany;
    } catch (error) {
      console.log(error);
    }
  }

  @Put('/:companyId/services/:serviceId')
  async addSpecialistToService(
    @Param('companyId') companyId: string,
    @Param('serviceId') serviceId: string,
    @Body() body: Partial<Service> & { specialistIds?: string[] },
  ) {
    if (!companyId) {
      throw new NotFoundException('Company not found');
    }

    if (!serviceId) {
      throw new NotFoundException('Service not found');
    }

    try {
      const service = await this.servicesService.updateService({
        serviceId,
        data: body,
      });

      return service;
    } catch (error) {
      console.log(error);
    }
  }

  @Delete('/:companyId/services/:serviceId')
  async deleteService(
    @Param('companyId') companyId: Types.ObjectId,
    @Param('serviceId') serviceId: Types.ObjectId,
  ) {
    if (!companyId) {
      throw new NotFoundException('Company not found');
    }

    if (!serviceId) {
      throw new NotFoundException('Service not found');
    }

    try {
      const service = await this.servicesService.deleteServiceBy({
        id: serviceId,
      });

      return service;
    } catch (error) {
      console.log(error);
    }
  }
}
