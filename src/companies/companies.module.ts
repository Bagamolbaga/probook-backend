import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Company, CompanySchema } from './schema/company.schema';
import { CompanyController } from './companies.controller';
import { CompanyService } from './companies.service';
import { Shift, ShiftSchema } from '../shift/schema/shift.schema';
import { ShiftModule } from '../shift/shift.module';
import { ServiceModule } from '../services/services.module';
import { ServiceSchema } from '../services/schema/services.schema';
import { UserModule } from '../user/user.module';

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
    UserModule,
  ],
  controllers: [CompanyController],
  providers: [CompanyService],
  exports: [CompanyService],
})
export class CompanyModule {}
