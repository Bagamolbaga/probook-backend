import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsMongoId,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { BookingStatus } from '../schema/booking.schema';

class BookingServiceSelectionDto {
  @IsMongoId()
  serviceId: string;

  @IsMongoId()
  optionId: string;
}

export class UpdateBookingDto {
  @IsMongoId()
  specialistId: string;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => BookingServiceSelectionDto)
  services: BookingServiceSelectionDto[];

  @IsDateString()
  date: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(95, { each: true })
  slots: number[];

  @IsEnum(BookingStatus)
  status: BookingStatus;
}
