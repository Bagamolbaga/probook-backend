import {
  Body,
  ConflictException,
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
  CreateCompanyDto,
  CompanyService,
  UpdateCompanyDto,
} from './companies.service';
import { Types } from 'mongoose';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CompanyOwnerGuard } from '../auth/guards/company-owner.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../user/schema/user.schema';
import { UserService } from '../user/user.service';

@Controller('companies')
export class CompanyController {
  constructor(
    private companyService: CompanyService,
    private userService: UserService,
  ) {}

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
  @UseGuards(JwtAuthGuard, CompanyOwnerGuard)
  async createCompany(
    @CurrentUser() user: User,
    @Body() body: CreateCompanyDto,
  ) {
    if (user.company) {
      throw new ConflictException('User already has a company');
    }

    const newCompany = await this.companyService.createCompany({
      ...body,
      owner: user._id,
    });
    await this.userService.setCompany(user._id, newCompany._id);

    return newCompany;
  }

  @Put('/:companyId')
  @UseGuards(JwtAuthGuard, CompanyOwnerGuard)
  async updateCompany(
    @CurrentUser() user: User,
    @Param('companyId') companyId: Types.ObjectId,
    @Body() body: UpdateCompanyDto,
  ) {
    return this.companyService.updateCompanyBy(
      { id: companyId, ownerId: user._id },
      body,
    );
  }

  @Delete('/:companyId')
  @UseGuards(JwtAuthGuard, CompanyOwnerGuard)
  async deleteCompany(
    @CurrentUser() user: User,
    @Param('companyId') companyId: Types.ObjectId,
  ) {
    const deletedCompany = await this.companyService.deleteCompanyBy({
      id: companyId,
      ownerId: user._id,
    });
    await this.userService.setCompany(user._id, null);

    return deletedCompany;
  }
}
