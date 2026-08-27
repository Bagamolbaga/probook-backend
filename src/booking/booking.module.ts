import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BookingController } from './booking.controller';
import { Booking, BookingSchema } from './schema/booking.schema';
import { BookingService } from './booking.service';
import { UserModule } from 'src/user/user.module';
import { SpecialistModule } from 'src/specialists/specialist.module';
import { ServiceModule } from 'src/services/services.module';
import { User, UserRole, UserSchema } from 'src/user/schema/user.schema';
import { SpecialistSchema } from 'src/specialists/schema/specialists.schema';
import { Service, ServiceSchema } from 'src/services/schema/services.schema';
import { AvailabilityModule } from 'src/availability/availability.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Booking.name,
        schema: BookingSchema,
      },
      {
        name: User.name,
        schema: UserSchema,
      },
      {
        name: Service.name,
        schema: ServiceSchema,
      },
      { name: UserRole.SPECIALIST, schema: SpecialistSchema },
    ]),
    UserModule,
    SpecialistModule,
    ServiceModule,
    AvailabilityModule,
  ],
  controllers: [BookingController],
  providers: [BookingService],
})
export class BookingModule {}
