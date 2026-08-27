import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Company, CompanySchema } from '../companies/schema/company.schema';
import { Service, ServiceSchema } from '../services/schema/services.schema';
import {
  ServiceCategory,
  ServiceCategorySchema,
} from './schema/service-category.schema';
import { ServiceCategoriesController } from './service-categories.controller';
import { ServiceCategoriesService } from './service-categories.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ServiceCategory.name, schema: ServiceCategorySchema },
      { name: Company.name, schema: CompanySchema },
      { name: Service.name, schema: ServiceSchema },
    ]),
  ],
  controllers: [ServiceCategoriesController],
  providers: [ServiceCategoriesService],
  exports: [ServiceCategoriesService],
})
export class ServiceCategoriesModule {}
