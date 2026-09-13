import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ServiceController } from './services.controller';
import { ServiceSchema } from './schema/services.schema';
import { ServiceService } from './services.service';
import { User, UserSchema } from '../user/schema/user.schema';
import {
  Specialist,
  SpecialistSchema,
} from '../specialists/schema/specialists.schema';
import {
  ServiceCategory,
  ServiceCategorySchema,
} from '../service-categories/schema/service-category.schema';
import { NotificationModule } from '../notification/notification.module';

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
        name: Specialist.name,
        schema: SpecialistSchema,
      },
      {
        name: ServiceCategory.name,
        schema: ServiceCategorySchema,
      },
    ]),
    NotificationModule,
  ],
  controllers: [ServiceController],
  providers: [ServiceService],
  exports: [ServiceService],
})
export class ServiceModule {}
