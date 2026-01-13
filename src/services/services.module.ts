import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ServiceController } from './services.controller';
import { ServiceSchema } from './schema/services.schema';
import { ServiceService } from './services.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: 'Service',
        schema: ServiceSchema,
      },
    ]),
  ],
  controllers: [ServiceController],
  providers: [ServiceService],
  exports: [ServiceService],
})
export class ServiceModule {}
