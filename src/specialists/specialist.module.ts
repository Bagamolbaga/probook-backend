import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserRole, UserSchema } from 'src/user/schema/user.schema';
import { SpecialistService } from './specialist.service';
import { SpecialistController } from './specialist.controller';
import { SpecialistSchema } from './schema/specialists.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: User.name,
        schema: UserSchema,
      },
      { name: UserRole.SPECIALIST, schema: SpecialistSchema },
    ]),
  ],
  controllers: [SpecialistController],
  providers: [SpecialistService],
  exports: [SpecialistService],
})
export class SpecialistModule {}
