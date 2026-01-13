import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Company, CompanySchema } from './schema/company.schema';
import { CompanyController } from './companies.controller';
import { CompanyService } from './companies.service';
import { Shift, ShiftSchema } from 'src/shift/schema/shift.schema';
import { ShiftModule } from 'src/shift/shift.module';
import { ServiceModule } from 'src/services/services.module';
import { ServiceSchema } from 'src/services/schema/services.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Company.name,
        schema: CompanySchema,
      },
      {
        name: Shift.name,
        schema: ShiftSchema,
      },
      {
        name: 'Service',
        schema: ServiceSchema,
      },
    ]),
    forwardRef(() => ShiftModule),
    forwardRef(() => ServiceModule),
  ],
  controllers: [CompanyController],
  providers: [CompanyService],
  exports: [CompanyService],
})
export class CompanyModule {}
