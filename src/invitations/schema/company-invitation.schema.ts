import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { CompanyRole } from '../../memberships/schema/company-membership.schema';

export enum InvitationStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REVOKED = 'REVOKED',
  EXPIRED = 'EXPIRED',
}
export enum InvitationDeliveryStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
}

@Schema({ timestamps: true })
export class CompanyInvitation {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  @Prop({ type: Types.ObjectId, ref: 'Company', required: true })
  companyId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  invitedByUserId: Types.ObjectId;
  @Prop({ required: true, lowercase: true, trim: true }) email: string;
  @Prop({ required: true }) firstName: string;
  @Prop({ required: true }) lastName: string;
  @Prop({ type: Object, required: true })
  specialistProfile: {
    firstName: string;
    lastName: string;
    bio?: string;
    specialties?: string[];
    serviceIds?: string[];
    defaultShiftId?: string;
  };
  @Prop({
    type: [String],
    enum: CompanyRole,
    default: [CompanyRole.SPECIALIST],
  })
  roles: CompanyRole[];
  @Prop({ required: true, select: false }) tokenHash: string;
  @Prop({ select: false }) tokenCiphertext?: string;
  @Prop({ required: true }) expiresAt: Date;
  @Prop({
    type: String,
    enum: InvitationStatus,
    default: InvitationStatus.PENDING,
  })
  status: InvitationStatus;
  @Prop({
    type: String,
    enum: InvitationDeliveryStatus,
    default: InvitationDeliveryStatus.PENDING,
  })
  deliveryStatus: InvitationDeliveryStatus;
  @Prop() deliveryError?: string;
  @Prop() lastSentAt?: Date;
  @Prop({ default: 0 }) sendAttempts: number;
  @Prop({ type: Types.ObjectId, ref: 'User' })
  acceptedByUserId?: Types.ObjectId;
  @Prop() acceptedAt?: Date;
}
export type CompanyInvitationDocument = HydratedDocument<CompanyInvitation>;
export const CompanyInvitationSchema =
  SchemaFactory.createForClass(CompanyInvitation);
CompanyInvitationSchema.set('toJSON', {
  transform: (_document, result) => {
    const output = result as unknown as Record<string, unknown>;
    output.id = result._id.toString();
    delete output._id;
    delete output.__v;
    delete output.tokenHash;
    return output;
  },
});
CompanyInvitationSchema.set('toObject', {
  transform: (_document, result) => {
    const output = result as unknown as Record<string, unknown>;
    output.id = result._id.toString();
    delete output._id;
    delete output.__v;
    delete output.tokenHash;
    return output;
  },
});
CompanyInvitationSchema.index({ companyId: 1, email: 1, status: 1 });
CompanyInvitationSchema.index({ tokenHash: 1 }, { unique: true });
CompanyInvitationSchema.index({ expiresAt: 1 });
