import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SpecialistService } from './specialist.service';
import { SpecialistController } from './specialist.controller';
import { Specialist, SpecialistSchema } from './schema/specialists.schema';
import { ServiceSchema } from '../services/schema/services.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Specialist.name, schema: SpecialistSchema },
      {
        name: 'Service',
        schema: ServiceSchema,
      },
    ]),
  ],
  controllers: [SpecialistController],
  providers: [SpecialistService],
  exports: [SpecialistService],
})
export class SpecialistModule {}
