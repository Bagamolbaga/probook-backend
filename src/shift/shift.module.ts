import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ShiftController } from './shift.controller';
import { Shift, ShiftSchema } from './schema/shift.schema';
import { ShiftService } from './shift.service';
import { SpecialistModule } from 'src/specialists/specialist.module';
import { CompanyModule } from 'src/companies/companies.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Shift.name,
        schema: ShiftSchema,
      },
    ]),
    SpecialistModule,
    forwardRef(() => CompanyModule),
  ],
  controllers: [ShiftController],
  providers: [ShiftService],
  exports: [ShiftService],
})
export class ShiftModule {}
