import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

export enum UserAccountStatus {
  ACTIVE = 'ACTIVE',
  UNCLAIMED = 'UNCLAIMED',
  SUSPENDED = 'SUSPENDED',
}

export enum AuthProvider {
  PASSWORD = 'password',
  GOOGLE = 'google',
  BOTH = 'both',
}

@Schema({ timestamps: true })
export class User {
  _id: Types.ObjectId;
  id: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true })
  firstName: string;

  @Prop({ required: true })
  lastName: string;

  @Prop({ default: null })
  avatar?: string | null;

  @Prop({ select: false })
  passwordHash?: string;

  @Prop({
    type: String,
    enum: AuthProvider,
    default: AuthProvider.PASSWORD,
  })
  authProvider: AuthProvider;

  @Prop()
  googleId?: string;

  @Prop({ default: false })
  emailVerified?: boolean;

  @Prop({ default: null, select: false })
  refreshTokenHash?: string | null;

  @Prop({ default: 0 })
  tokenVersion?: number;

  @Prop({
    type: String,
    enum: UserAccountStatus,
    default: UserAccountStatus.ACTIVE,
  })
  accountStatus: UserAccountStatus;

  @Prop()
  lastLoginAt?: Date;

  get fullName(): string {
    return `${this.firstName} ${this.lastName}`.trim();
  }

  createdAt?: Date;
  updatedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`.trim();
});

// UserSchema.index({ email: 1 });
UserSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toHexString();
    delete ret._id;
    delete ret.__v;
    delete ret.passwordHash;
    delete ret.refreshTokenHash;
    delete ret.tokenVersion;
    return ret;
  },
});

UserSchema.set('toObject', {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toHexString();
    delete ret._id;
    delete ret.__v;
    delete ret.passwordHash;
    delete ret.refreshTokenHash;
    delete ret.tokenVersion;
    return ret;
  },
});

UserSchema.index({ googleId: 1 }, { unique: true, sparse: true });
