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
  UseGuards,
} from '@nestjs/common';
import { ServiceService } from './services.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CompanyOwnerGuard } from '../auth/guards/company-owner.guard';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { CreateServiceDto, UpdateServiceDto } from './dto/service.dto';

@Controller('companies')
export class ServiceController {
  constructor(private servicesService: ServiceService) {}

  @Get('/:companyId/services')
  async getCompanies(@Param('companyId', ParseObjectIdPipe) companyId: string) {
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
  @UseGuards(JwtAuthGuard, CompanyOwnerGuard)
  async createCompany(
    @Param('companyId', ParseObjectIdPipe) companyId: string,
    @Body() body: CreateServiceDto,
  ) {
    const newCompany = await this.servicesService.createService({
      companyId,
      ...body,
    });

    return newCompany;
  }

  @Put('/:companyId/services/:serviceId')
  @UseGuards(JwtAuthGuard, CompanyOwnerGuard)
  async addSpecialistToService(
    @Param('companyId', ParseObjectIdPipe) companyId: string,
    @Param('serviceId', ParseObjectIdPipe) serviceId: string,
    @Body() body: UpdateServiceDto,
  ) {
    if (!companyId) {
      throw new NotFoundException('Company not found');
    }

    if (!serviceId) {
      throw new NotFoundException('Service not found');
    }

    const service = await this.servicesService.updateService({
      companyId,
      serviceId,
      data: body,
    });

    return service;
  }

  @Delete('/:companyId/services/:serviceId')
  @UseGuards(JwtAuthGuard, CompanyOwnerGuard)
  async deleteService(
    @Param('companyId', ParseObjectIdPipe) companyId: string,
    @Param('serviceId', ParseObjectIdPipe) serviceId: string,
  ) {
    if (!companyId) {
      throw new NotFoundException('Company not found');
    }

    if (!serviceId) {
      throw new NotFoundException('Service not found');
    }

    const service = await this.servicesService.deleteServiceBy({
      id: serviceId,
      companyId,
    });

    return service;
  }
}
