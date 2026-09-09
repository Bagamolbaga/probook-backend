import {
  IsArray,
  IsBoolean,
  IsMongoId,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateSpecialistProfileDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specialties?: string[];

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  serviceIds?: string[];

  @IsOptional()
  @IsMongoId()
  defaultShiftId?: string;
}

export class UpdateSpecialistByOwnerDto extends UpdateSpecialistProfileDto {
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
