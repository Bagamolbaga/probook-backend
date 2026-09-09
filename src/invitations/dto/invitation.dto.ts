import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CompanyRole } from '../../memberships/schema/company-membership.schema';

export class InvitationSpecialistProfileDto {
  @IsString() @MinLength(1) firstName: string;
  @IsString() @MinLength(1) lastName: string;
  @IsOptional() @IsString() bio?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) specialties?: string[];
  @IsOptional() @IsArray() @IsMongoId({ each: true }) serviceIds?: string[];
  @IsOptional() @IsMongoId() defaultShiftId?: string;
}
export class CreateInvitationDto {
  @IsEmail() email: string;
  @ValidateNested()
  @Type(() => InvitationSpecialistProfileDto)
  specialistProfile: InvitationSpecialistProfileDto;
  @IsOptional()
  @IsArray()
  @IsEnum(CompanyRole, { each: true })
  roles?: CompanyRole[];
}

export class RegisterInvitationPasswordDto {
  @IsString() @MinLength(8) password: string;
}
