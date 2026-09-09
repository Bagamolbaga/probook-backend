import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Service } from '../../services/schema/services.schema';
import { User } from '../../user/schema/user.schema';

@Schema({ timestamps: true, collection: 'specialistprofiles' })
export class Specialist {
  _id: Types.ObjectId;
  id: string;
  @Prop({ type: Types.ObjectId, ref: 'User', required: true }) userId:
    | Types.ObjectId
    | User;
  @Prop({ type: Types.ObjectId, ref: 'Company', required: true })
  company: Types.ObjectId;
  @Prop({ type: [String], default: [] }) specialties: string[];
  @Prop() bio?: string;
  @Prop({ type: Number, min: 0, max: 5, default: 0 }) rating?: number;
  @Prop({ type: Types.ObjectId, ref: 'Shift', default: null })
  defaultShift?: Types.ObjectId;
  @Prop({ type: [{ type: Types.ObjectId, ref: 'Service' }], default: [] })
  services: Types.ObjectId[];
  @Prop({ default: true }) active: boolean;
  servicesPopulated?: Service[];
}

export type SpecialistDocument = HydratedDocument<Specialist>;
export const SpecialistSchema = SchemaFactory.createForClass(Specialist);
SpecialistSchema.index({ company: 1, userId: 1 }, { unique: true });
SpecialistSchema.virtual('servicesPopulated', {
  ref: 'Service',
  localField: 'services',
  foreignField: '_id',
  justOne: false,
});
SpecialistSchema.set('toJSON', { virtuals: true });
