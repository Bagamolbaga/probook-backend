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
import { CompanyPermissionGuard } from '../memberships/company-permission.guard';
import { CompanyPermission } from '../memberships/membership.service';
import { RequireCompanyPermission } from '../memberships/require-company-permission.decorator';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { CreateServiceDto, UpdateServiceDto } from './dto/service.dto';
import { RealtimeService } from '../notification/realtime.service';

@Controller('companies')
export class ServiceController {
  constructor(
    private servicesService: ServiceService,
    private realtimeService: RealtimeService,
  ) {}

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
  @UseGuards(JwtAuthGuard, CompanyPermissionGuard)
  @RequireCompanyPermission(CompanyPermission.COMPANY_MANAGE)
  async createCompany(
    @Param('companyId', ParseObjectIdPipe) companyId: string,
    @Body() body: CreateServiceDto,
  ) {
    const newCompany = await this.servicesService.createService({
      companyId,
      ...body,
    });
    this.realtimeService.publishCompanyDataUpdated(companyId, 'services');

    return newCompany;
  }

  @Put('/:companyId/services/:serviceId')
  @UseGuards(JwtAuthGuard, CompanyPermissionGuard)
  @RequireCompanyPermission(CompanyPermission.COMPANY_MANAGE)
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
    this.realtimeService.publishCompanyDataUpdated(companyId, 'services');

    return service;
  }

  @Delete('/:companyId/services/:serviceId')
  @UseGuards(JwtAuthGuard, CompanyPermissionGuard)
  @RequireCompanyPermission(CompanyPermission.COMPANY_MANAGE)
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
    this.realtimeService.publishCompanyDataUpdated(companyId, 'services');

    return service;
  }
}
