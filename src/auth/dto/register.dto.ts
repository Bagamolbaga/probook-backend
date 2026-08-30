import { Type } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

class RegisterCompanyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  businessType?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(12)
  zipCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  city?: string;

  @IsOptional()
  @IsObject()
  pos?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  workingSchedule?: Record<string, unknown>;
}

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ValidateNested()
  @Type(() => RegisterCompanyDto)
  company: RegisterCompanyDto;
}
