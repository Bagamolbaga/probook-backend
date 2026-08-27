import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserRole, UserSchema } from '../user/schema/user.schema';
import { SpecialistService } from './specialist.service';
import { SpecialistController } from './specialist.controller';
import { SpecialistSchema } from './schema/specialists.schema';
import { ServiceSchema } from '../services/schema/services.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: User.name,
        schema: UserSchema,
      },
      { name: UserRole.SPECIALIST, schema: SpecialistSchema },
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
