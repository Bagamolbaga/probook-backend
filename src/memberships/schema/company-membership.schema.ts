import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export enum CompanyRole {
  OWNER = 'OWNER',
  SPECIALIST = 'SPECIALIST',
}

export enum MembershipStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
}

@Schema({ timestamps: true })
export class CompanyMembership {
  _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Company', required: true })
  companyId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: [String], enum: CompanyRole, required: true })
  roles: CompanyRole[];

  @Prop({
    type: String,
    enum: MembershipStatus,
    default: MembershipStatus.ACTIVE,
  })
  status: MembershipStatus;
}

export type CompanyMembershipDocument = HydratedDocument<CompanyMembership>;
export const CompanyMembershipSchema =
  SchemaFactory.createForClass(CompanyMembership);
CompanyMembershipSchema.index({ companyId: 1, userId: 1 }, { unique: true });
CompanyMembershipSchema.index({ userId: 1, status: 1 });
