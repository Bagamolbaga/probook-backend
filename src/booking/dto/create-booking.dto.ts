import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsMongoId,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { BookingStatus } from '../schema/booking.schema';

class BookingCustomerDto {
  @IsEmail() email: string;
  @IsString() first_name: string;
  @IsString() last_name: string;
}
class BookingServiceSelectionDto {
  @IsMongoId() serviceId: string;
  @IsMongoId() optionId: string;
}
export class CreateBookingRequestDto {
  @IsMongoId() specialist: string;
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BookingServiceSelectionDto)
  services: BookingServiceSelectionDto[];
  @ValidateNested()
  @Type(() => BookingCustomerDto)
  customer: BookingCustomerDto;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) date: string;
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Min(0, { each: true })
  slots: number[];
}
export class RescheduleMyBookingDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/) date: string;
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Min(0, { each: true })
  slots: number[];
}
export class UpdateMyBookingStatusDto {
  @IsEnum(BookingStatus) status: BookingStatus;
}
