import { Controller, Get, Param, Query } from '@nestjs/common';
import { AvailabilityService } from './availability.service';

@Controller('companies')
export class AvailabilityController {
  constructor(private availabilityService: AvailabilityService) {}

  @Get('/:companyId/specialists/:specialistId/availability')
  async getAvailability(
    @Param('companyId') companyId: string,
    @Param('specialistId') specialistId: string,
    @Query('date') date: string,
    @Query('excludeBookingId') excludeBookingId?: string,
  ) {
    return this.availabilityService.getAvailability({
      companyId,
      specialistId,
      date,
      slots: [],
      excludeBookingId,
    });
  }
}
