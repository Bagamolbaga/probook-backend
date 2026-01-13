import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { User, UserRole, UserSchema } from 'src/user/schema/user.schema';
@Schema()
export class Customer extends User {
  @Prop({ type: String })
  phone?: string;

  @Prop({ type: Date })
  birthDate?: Date;

  @Prop({ default: '' })
  notes?: string;

  // bookingsCount?: number;
  // moneySpent?: number;

  readonly role = UserRole.CUSTOMER;
}

export const CustomerSchema = UserSchema.discriminator(
  UserRole.CUSTOMER,
  SchemaFactory.createForClass(Customer),
);
