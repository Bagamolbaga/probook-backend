import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CompanyOwnerGuard } from '../auth/guards/company-owner.guard';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { CreateServiceCategoryDto } from './dto/create-service-category.dto';
import { UpdateServiceCategoryDto } from './dto/update-service-category.dto';
import { ServiceCategoriesService } from './service-categories.service';

@Controller('companies')
export class ServiceCategoriesController {
  constructor(private serviceCategoriesService: ServiceCategoriesService) {}

  @Get('/:companyId/service-categories')
  async getAvailableCategories(
    @Param('companyId', ParseObjectIdPipe) companyId: string,
  ) {
    const categories =
      await this.serviceCategoriesService.getAvailableCategories(companyId);

    return {
      count: categories.length,
      next: null,
      previous: null,
      results: categories,
    };
  }

  @Post('/:companyId/service-categories')
  @UseGuards(JwtAuthGuard, CompanyOwnerGuard)
  createCompanyCategory(
    @Param('companyId', ParseObjectIdPipe) companyId: string,
    @Body() body: CreateServiceCategoryDto,
  ) {
    return this.serviceCategoriesService.createCompanyCategory(companyId, body);
  }

  @Put('/:companyId/service-categories/:categoryId')
  @UseGuards(JwtAuthGuard, CompanyOwnerGuard)
  updateCompanyCategory(
    @Param('companyId', ParseObjectIdPipe) companyId: string,
    @Param('categoryId', ParseObjectIdPipe) categoryId: string,
    @Body() body: UpdateServiceCategoryDto,
  ) {
    return this.serviceCategoriesService.updateCompanyCategory(
      companyId,
      categoryId,
      body,
    );
  }

  @Delete('/:companyId/service-categories/:categoryId')
  @UseGuards(JwtAuthGuard, CompanyOwnerGuard)
  deleteCompanyCategory(
    @Param('companyId', ParseObjectIdPipe) companyId: string,
    @Param('categoryId', ParseObjectIdPipe) categoryId: string,
  ) {
    return this.serviceCategoriesService.deleteCompanyCategory(
      companyId,
      categoryId,
    );
  }
}
