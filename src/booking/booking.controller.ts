import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Types } from 'mongoose';
import { BookingService, CreateBookingDto } from './booking.service';

@Controller('companies')
export class BookingController {
  constructor(private bookingService: BookingService) {}

  @Get('/:companyId/bookings')
  async getBookings(@Param('companyId') companyId: Types.ObjectId) {
    const bookings = await this.bookingService.getBookings({ companyId });
    return {
      count: bookings.length,
      next: null,
      previous: null,
      results: bookings,
    };
  }

  @Get('/:companyId/bookings/min')
  async getBookingsMin(@Param('companyId') companyId: Types.ObjectId) {
    const bookings = await this.bookingService.getBookingsMin({ companyId });
    return {
      count: bookings.length,
      next: null,
      previous: null,
      results: bookings,
    };
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
