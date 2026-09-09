import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CompanyPermissionGuard } from '../memberships/company-permission.guard';
import {
  CompanyPermission,
  MembershipService,
} from '../memberships/membership.service';
import { RequireCompanyPermission } from '../memberships/require-company-permission.decorator';
import { CompanyRole } from '../memberships/schema/company-membership.schema';
import { SpecialistService } from '../specialists/specialist.service';
import { User } from '../user/schema/user.schema';
import { BookingService } from './booking.service';
import {
  CreateBookingRequestDto,
  RescheduleMyBookingDto,
  UpdateMyBookingStatusDto,
} from './dto/create-booking.dto';
import { GetBookingsQueryDto } from './dto/get-bookings-query.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';

@Controller('companies')
export class BookingController {
  constructor(
    private readonly bookings: BookingService,
    private readonly memberships: MembershipService,
    private readonly specialists: SpecialistService,
  ) {}

  @Get('/:companyId/bookings')
  @UseGuards(JwtAuthGuard)
  getBookings(
    @Param('companyId') companyId: string,
    @Query() query: GetBookingsQueryDto,
    @CurrentUser() user: User,
  ) {
    return this.scopedBookings(user, companyId, query, false);
  }

  @Get('/:companyId/bookings/min')
  @UseGuards(JwtAuthGuard)
  getBookingsMin(
    @Param('companyId') companyId: string,
    @Query() query: GetBookingsQueryDto,
    @CurrentUser() user: User,
  ) {
    return this.scopedBookings(user, companyId, query, true);
  }

  @Get('/:companyId/bookings/:bookingId')
  @UseGuards(JwtAuthGuard)
  async getBooking(
    @Param('companyId') companyId: string,
    @Param('bookingId') bookingId: string,
    @CurrentUser() user: User,
  ) {
    const membership = (
      await this.memberships.findActive(user._id, companyId)
    )[0];
    if (!membership)
      throw new ForbiddenException('No active company membership');
    const booking = await this.bookings.getBooking({
      companyId: new Types.ObjectId(companyId),
      bookingId: new Types.ObjectId(bookingId),
    });
    if (!membership.roles.includes(CompanyRole.OWNER)) {
      const profile = await this.specialists.getSpecialistBy({
        userId: user._id,
        companyId,
      });
      if (
        !profile ||
        booking.specialist._id.toString() !== profile._id.toString()
      )
        throw new ForbiddenException(
          'Booking is not assigned to current specialist',
        );
    }
    return booking;
  }

  @Patch('/:companyId/bookings/:bookingId')
  @UseGuards(JwtAuthGuard, CompanyPermissionGuard)
  @RequireCompanyPermission(CompanyPermission.BOOKINGS_READ_ALL)
  updateBooking(
    @Param('companyId') companyId: Types.ObjectId,
    @Param('bookingId') bookingId: Types.ObjectId,
    @Body() body: UpdateBookingDto,
  ) {
    return this.bookings.updateBooking({ companyId, bookingId, ...body });
  }

  @Post('/:companyId/bookings')
  @UseGuards(OptionalJwtAuthGuard)
  async createBooking(
    @Param('companyId') companyId: Types.ObjectId,
    @Body() body: CreateBookingRequestDto,
    @CurrentUser() user?: User,
  ) {
    let specialistId = body.specialist;
    if (user) {
      const membership = (
        await this.memberships.findActive(user._id, companyId)
      )[0];
      if (membership && !membership.roles.includes(CompanyRole.OWNER)) {
        const profile = await this.specialists.getSpecialistBy({
          userId: user._id,
          companyId,
        });
        if (!profile)
          throw new ForbiddenException('Specialist profile not found');
        specialistId = profile._id.toString();
      }
    }
    return this.bookings.createBooking({
      company: companyId,
      ...body,
      specialist: new Types.ObjectId(specialistId),
      services: body.services.map((item) => ({
        serviceId: new Types.ObjectId(item.serviceId),
        optionId: item.optionId,
      })),
    });
  }

  @Patch('/:companyId/my/bookings/:bookingId/reschedule')
  @UseGuards(JwtAuthGuard)
  async reschedule(
    @Param('companyId') companyId: string,
    @Param('bookingId') bookingId: string,
    @Body() body: RescheduleMyBookingDto,
    @CurrentUser() user: User,
  ) {
    const profile = await this.requireProfile(user, companyId);
    return this.bookings.rescheduleAssignedBooking({
      companyId,
      bookingId,
      specialistId: profile._id.toString(),
      ...body,
    });
  }

  @Patch('/:companyId/my/bookings/:bookingId/status')
  @UseGuards(JwtAuthGuard)
  async updateStatus(
    @Param('companyId') companyId: string,
    @Param('bookingId') bookingId: string,
    @Body() body: UpdateMyBookingStatusDto,
    @CurrentUser() user: User,
  ) {
    const profile = await this.requireProfile(user, companyId);
    return this.bookings.updateAssignedBookingStatus({
      companyId,
      bookingId,
      specialistId: profile._id.toString(),
      status: body.status,
    });
  }

  @Get('/:companyId/customers')
  @UseGuards(JwtAuthGuard, CompanyPermissionGuard)
  @RequireCompanyPermission(
    CompanyPermission.CUSTOMERS_READ,
    CompanyPermission.CUSTOMERS_READ_ASSIGNED,
  )
  async customers(
    @Param('companyId') companyId: Types.ObjectId,
    @CurrentUser() user: User,
  ) {
    const specialistId = await this.getCustomerScope(
      user,
      companyId.toString(),
    );
    const results = await this.bookings.getBookingsCustomers({
      companyId,
      specialistId,
    });
    return { count: results.length, next: null, previous: null, results };
  }

  @Get('/:companyId/customers/:customerId')
  @UseGuards(JwtAuthGuard, CompanyPermissionGuard)
  @RequireCompanyPermission(
    CompanyPermission.CUSTOMERS_READ,
    CompanyPermission.CUSTOMERS_READ_ASSIGNED,
  )
  async customer(
    @Param('companyId') companyId: Types.ObjectId,
    @Param('customerId') customerId: Types.ObjectId,
    @CurrentUser() user: User,
  ) {
    const assignedSpecialistId = await this.getCustomerScope(
      user,
      companyId.toString(),
    );
    return this.bookings.getCustomerDetails({
      companyId,
      customerId,
      assignedSpecialistId,
    });
  }

  @Get('/:companyId/customers/:customerId/bookings')
  @UseGuards(JwtAuthGuard, CompanyPermissionGuard)
  @RequireCompanyPermission(
    CompanyPermission.CUSTOMERS_READ,
    CompanyPermission.CUSTOMERS_READ_ASSIGNED,
  )
  async customerBookings(
    @Param('companyId') companyId: Types.ObjectId,
    @Param('customerId') customerId: Types.ObjectId,
    @CurrentUser() user: User,
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
    @Query('ordering') ordering?: string,
  ) {
    const assignedSpecialistId = await this.getCustomerScope(
      user,
      companyId.toString(),
    );
    return this.bookings.getCustomerBookings({
      companyId,
      customerId,
      assignedSpecialistId,
      offset,
      limit,
      ordering,
    });
  }

  private async scopedBookings(
    user: User,
    companyId: string,
    query: GetBookingsQueryDto,
    min: boolean,
  ) {
    const membership = (
      await this.memberships.findActive(user._id, companyId)
    )[0];
    if (!membership)
      throw new ForbiddenException('No active company membership');
    let specialistId = query.specialist_id;
    if (!membership.roles.includes(CompanyRole.OWNER))
      specialistId = (
        await this.requireProfile(user, companyId)
      )._id.toString();
    const dto = {
      companyId: new Types.ObjectId(companyId),
      startDate: query.start_date,
      endDate: query.end_date,
      offset: query.offset,
      limit: query.limit,
      specialistId,
    };
    return min
      ? this.bookings.getBookingsMin(dto)
      : this.bookings.getBookings(dto);
  }

  private async requireProfile(user: User, companyId: string) {
    const membership = (
      await this.memberships.findActive(user._id, companyId)
    )[0];
    if (!membership?.roles.includes(CompanyRole.SPECIALIST))
      throw new ForbiddenException('Active specialist membership required');
    const profile = await this.specialists.getSpecialistBy({
      userId: user._id,
      companyId,
    });
    if (!profile?.active)
      throw new ForbiddenException('Active specialist profile required');
    return profile;
  }

  private async getCustomerScope(user: User, companyId: string) {
    const membership = (
      await this.memberships.findActive(user._id, companyId)
    )[0];
    if (!membership)
      throw new ForbiddenException('No active company membership');
    if (membership.roles.includes(CompanyRole.OWNER)) return undefined;
    return (await this.requireProfile(user, companyId))._id.toString();
  }
}
