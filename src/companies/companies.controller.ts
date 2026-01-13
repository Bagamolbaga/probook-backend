import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Request,
} from '@nestjs/common';
import { CreateCompanyDto, CompanyService } from './companies.service';
import { Types } from 'mongoose';

@Controller('companies')
export class CompanyController {
  constructor(private companyService: CompanyService) {}

  @Get('/list')
  async getCompanies() {
    const companies = await this.companyService.getCompanies();

    return {
      count: companies.length,
      next: null,
      previous: null,
      results: companies,
    };
  }

  @Get('/:companyId')
  async getCompanyBy(@Param('companyId') companyId: Types.ObjectId) {
    if (
      !companyId ||
      typeof companyId !== 'string' ||
      Number.isInteger(Number(companyId))
    )
      return null;

    const user = await this.companyService.getCompanyBy({ id: companyId });

    if (!user) {
      throw new NotFoundException('Company not found');
    }

    return user;
  }

  @Post()
  async createCompany(@Request() req, @Body() body: CreateCompanyDto) {
    try {
      const newCompany = await this.companyService.createCompany(body);

      //TODO set `company` field to user.company

      return newCompany;
    } catch (error) {
      console.log(error);
    }
  }
}
