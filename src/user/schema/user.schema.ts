import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Company } from '../../companies/schema/company.schema';

export type UserDocument = HydratedDocument<User>;

export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  SPECIALIST = 'specialist',
  CUSTOMER = 'customer',
  OWNER = 'owner',
}

@Schema({ timestamps: true })
export class User {
  _id: Types.ObjectId;
  id: string;

  // null = без компании (например, владелец, который ещё не создал компанию)
  @Prop({
    type: Types.ObjectId,
    ref: 'Company',
    default: null,
    sparse: true, // позволяет иметь много null значений
  })
  company?: Types.ObjectId | Company | null;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true })
  firstName: string;

  @Prop({ required: true })
  lastName: string;

  @Prop({ default: null })
  avatar?: string | null;

  @Prop({
    type: String,
    enum: UserRole,
    default: UserRole.CUSTOMER,
  })
  role: UserRole;

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
// UserSchema.index({ company: 1 });
// UserSchema.index({ role: 1 });

UserSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toHexString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

UserSchema.set('toObject', {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toHexString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});
