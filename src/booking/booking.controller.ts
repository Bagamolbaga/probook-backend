import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { BookingService, CreateBookingDto } from './booking.service';
import { GetBookingsQueryDto } from './dto/get-bookings-query.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CompanyOwnerGuard } from '../auth/guards/company-owner.guard';

@Controller('companies')
export class BookingController {
  constructor(private bookingService: BookingService) {}

  @Get('/:companyId/bookings')
  async getBookings(
    @Param('companyId') companyId: Types.ObjectId,
    @Query() query: GetBookingsQueryDto,
  ) {
    return this.bookingService.getBookings({
      companyId,
      startDate: query.start_date,
      endDate: query.end_date,
      offset: query.offset,
      limit: query.limit,
      specialistId: query.specialist_id,
    });
  }

  @Get('/:companyId/bookings/min')
  async getBookingsMin(
    @Param('companyId') companyId: Types.ObjectId,
    @Query() query: GetBookingsQueryDto,
  ) {
    return this.bookingService.getBookingsMin({
      companyId,
      startDate: query.start_date,
      endDate: query.end_date,
      offset: query.offset,
      limit: query.limit,
      specialistId: query.specialist_id,
    });
  }

  @Get('/:companyId/bookings/:bookingId')
  async getBooking(
    @Param('companyId') companyId: Types.ObjectId,
    @Param('bookingId') bookingId: Types.ObjectId,
  ) {
    return this.bookingService.getBooking({ companyId, bookingId });
  }

  @Patch('/:companyId/bookings/:bookingId')
  @UseGuards(JwtAuthGuard, CompanyOwnerGuard)
  async updateBooking(
    @Param('companyId') companyId: Types.ObjectId,
    @Param('bookingId') bookingId: Types.ObjectId,
    @Body() body: UpdateBookingDto,
  ) {
    return this.bookingService.updateBooking({
      companyId,
      bookingId,
      ...body,
    });
  }

  @Post('/:companyId/bookings')
  async createBooking(
    @Param('companyId') companyId: Types.ObjectId,
    @Body() body: CreateBookingDto,
  ) {
    const booking = await this.bookingService.createBooking({
      company: companyId,
      ...body,
    });
    return booking;
  }

  @Get('/:companyId/customers')
  async getBookingsCustomers(@Param('companyId') companyId: Types.ObjectId) {
    const customers = await this.bookingService.getBookingsCustomers({
      companyId,
    });
    return {
      count: customers.length,
      next: null,
      previous: null,
      results: customers,
    };
  }

  @Get('/:companyId/customers/:customerId')
  async getCustomerDetails(
    @Param('companyId') companyId: Types.ObjectId,
    @Param('customerId') customerId: Types.ObjectId,
  ) {
    return this.bookingService.getCustomerDetails({ companyId, customerId });
  }

  @Get('/:companyId/customers/:customerId/bookings')
  async getCustomerBookings(
    @Param('companyId') companyId: Types.ObjectId,
    @Param('customerId') customerId: Types.ObjectId,
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
    @Query('ordering') ordering?: string,
  ) {
    return this.bookingService.getCustomerBookings({
      companyId,
      customerId,
      offset,
      limit,
      ordering,
    });
  }
}
