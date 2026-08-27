import { Type } from 'class-transformer';
import { Types } from 'mongoose';
import {
  IsArray,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export type SpecialistReference =
  | string
  | Types.ObjectId
  | { _id: string | Types.ObjectId };

export class ServiceOptionDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(510)
  description?: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsNumber()
  @Min(1)
  duration: number;
}

class ServiceFieldsDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(510)
  description?: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceOptionDto)
  options?: ServiceOptionDto[];

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  specialistIds?: string[];

  // Legacy request field retained while clients migrate to specialistIds.
  @IsOptional()
  @IsArray()
  specialists?: SpecialistReference[];
}

export class CreateServiceDto extends ServiceFieldsDto {
  @IsMongoId()
  categoryId: string;
}

export class UpdateServiceDto extends ServiceFieldsDto {
  @IsOptional()
  @IsMongoId()
  categoryId?: string;
}
