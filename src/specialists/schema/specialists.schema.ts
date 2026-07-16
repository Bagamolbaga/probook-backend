import { Prop, Schema } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types } from 'mongoose';
import { Service } from 'src/services/schema/services.schema';
import { User, UserRole, UserSchema } from 'src/user/schema/user.schema';

@Schema()
export class Specialist extends User {
  @Prop({ type: [String], default: [] })
  specialties: string[];

  @Prop({ type: String })
  bio?: string;

  @Prop({ type: Number, min: 0, max: 5, default: 0 })
  rating?: number;

  @Prop({ type: Types.ObjectId, ref: 'Shift' })
  defaultShift?: Types.ObjectId;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Service' }], default: [] })
  services: Types.ObjectId[];

  servicesPopulated?: Service[];

  readonly role = UserRole.SPECIALIST;
}

const SpecialistSchemaDefinition = {
  specialties: { type: [String], default: [] },
  bio: { type: String },
  rating: { type: Number, min: 0, max: 5, default: 0 },
  defaultShift: { type: Types.ObjectId, ref: 'Shift', default: null },
  services: { type: [{ type: Types.ObjectId, ref: 'Service' }], default: [] },
};

const SpecialistExtraSchema = new MongooseSchema(SpecialistSchemaDefinition, {
  _id: false,
});

export const SpecialistSchema = UserSchema.discriminator(
  UserRole.SPECIALIST,
  SpecialistExtraSchema,
);

SpecialistSchema.virtual('servicesPopulated', {
  ref: 'Service',
  localField: 'services',
  foreignField: '_id',
  justOne: false,
});
