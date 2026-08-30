import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Booking, BookingSchema } from 'src/booking/schema/booking.schema';
import { Company, CompanySchema } from 'src/companies/schema/company.schema';
import { Shift, ShiftSchema } from 'src/shift/schema/shift.schema';
import { Schedule, ScheduleSchema } from 'src/schedule/schema/schedule.schema';
import { SpecialistSchema } from 'src/specialists/schema/specialists.schema';
import { UserRole } from 'src/user/schema/user.schema';
import { AvailabilityController } from './availability.controller';
import { AvailabilityService } from './availability.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Booking.name, schema: BookingSchema },
      { name: Company.name, schema: CompanySchema },
      { name: Shift.name, schema: ShiftSchema },
      { name: Schedule.name, schema: ScheduleSchema },
      { name: UserRole.SPECIALIST, schema: SpecialistSchema },
    ]),
  ],
  controllers: [AvailabilityController],
  providers: [AvailabilityService],
  exports: [AvailabilityService],
})
export class AvailabilityModule {}
