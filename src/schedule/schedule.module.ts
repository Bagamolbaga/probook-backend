import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleController } from './schedule.controller';
import { Schedule, ScheduleSchema } from './schema/schedule.schema';
import { ScheduleService } from './schedule.service';
import { AvailabilityModule } from 'src/availability/availability.module';
import { SpecialistModule } from '../specialists/specialist.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Schedule.name,
        schema: ScheduleSchema,
      },
    ]),
    AvailabilityModule,
    SpecialistModule,
  ],
  controllers: [ScheduleController],
  providers: [ScheduleService],
  exports: [ScheduleService],
})
export class ScheduleModule {}
