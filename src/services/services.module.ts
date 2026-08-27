import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ServiceController } from './services.controller';
import { ServiceSchema } from './schema/services.schema';
import { ServiceService } from './services.service';
import { User, UserRole, UserSchema } from '../user/schema/user.schema';
import { SpecialistSchema } from '../specialists/schema/specialists.schema';
import {
  ServiceCategory,
  ServiceCategorySchema,
} from '../service-categories/schema/service-category.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: 'Service',
        schema: ServiceSchema,
      },
      {
        name: User.name,
        schema: UserSchema,
      },
      {
        name: UserRole.SPECIALIST,
        schema: SpecialistSchema,
      },
      {
        name: ServiceCategory.name,
        schema: ServiceCategorySchema,
      },
    ]),
  ],
  controllers: [ServiceController],
  providers: [ServiceService],
  exports: [ServiceService],
})
export class ServiceModule {}
