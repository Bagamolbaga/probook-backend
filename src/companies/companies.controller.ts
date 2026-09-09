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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../user/schema/user.schema';
import {
  CompanyPermission,
  MembershipService,
} from '../memberships/membership.service';
import { CompanyRole } from '../memberships/schema/company-membership.schema';
import { CompanyPermissionGuard } from '../memberships/company-permission.guard';
import { RequireCompanyPermission } from '../memberships/require-company-permission.decorator';

@Controller('companies')
export class CompanyController {
  constructor(
    private companyService: CompanyService,
    private membershipService: MembershipService,
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
  @UseGuards(JwtAuthGuard)
  async createCompany(
    @CurrentUser() user: User,
    @Body() body: CreateCompanyDto,
  ) {
    const newCompany = await this.companyService.createCompany({
      ...body,
      owner: user._id,
    });
    await this.membershipService.upsertRole(
      user._id,
      newCompany._id,
      CompanyRole.OWNER,
    );

    return newCompany;
  }

  @Put('/:companyId')
  @UseGuards(JwtAuthGuard, CompanyPermissionGuard)
  @RequireCompanyPermission(CompanyPermission.COMPANY_MANAGE)
  async updateCompany(
    @Param('companyId') companyId: Types.ObjectId,
    @Body() body: UpdateCompanyDto,
  ) {
    return this.companyService.updateCompanyBy({ id: companyId }, body);
  }

  @Delete('/:companyId')
  @UseGuards(JwtAuthGuard, CompanyPermissionGuard)
  @RequireCompanyPermission(CompanyPermission.COMPANY_MANAGE)
  async deleteCompany(@Param('companyId') companyId: Types.ObjectId) {
    const deletedCompany = await this.companyService.deleteCompanyBy({
      id: companyId,
    });
    await this.membershipService.deleteByCompany(companyId);

    return deletedCompany;
  }
}
