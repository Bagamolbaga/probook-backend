import { Type } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CustomerLookupQueryDto {
  @IsString()
  @MinLength(3)
  @MaxLength(254)
  search: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;
}

export class CustomerLookupByEmailQueryDto {
  @IsEmail()
  @MaxLength(254)
  email: string;
}
