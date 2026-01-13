/* eslint-disable @typescript-eslint/ban-ts-comment */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Company } from 'src/companies/schema/company.schema';
import { Specialist } from 'src/specialists/schema/specialists.schema';
import { UserRole } from 'src/user/schema/user.schema';

@Schema({ timestamps: true })
export class ServiceOption {
  @Prop({ type: String, maxlength: 255 })
  name: string;

  @Prop({ type: String, maxlength: 255 * 2 })
  description?: string;

  @Prop({ type: Number, required: true, min: 0 })
  price: number;

  @Prop({ type: Number, required: true, min: 1 })
  duration: number;
}

@Schema({
  timestamps: true,
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform: (doc, ret) => {
      //@ts-ignore
      ret.id = ret._id;
      return ret;
    },
  },
  toObject: {
    virtuals: true,
    versionKey: false,
    transform: (doc, ret) => {
      //@ts-ignore
      ret.id = ret._id;
      return ret;
    },
  },
})
export class Service extends Document {
  @Prop({ type: String, maxlength: 255 })
  name: string;

  @Prop({ type: String, maxlength: 255 * 2 })
  description?: string;

  @Prop({ type: String })
  image?: string;

  @Prop({ type: Types.ObjectId, ref: Company.name, required: true })
  company: Types.ObjectId | Company;

  @Prop({ type: [ServiceOption], default: [] })
  options: ServiceOption[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  specialists: Types.ObjectId[] | Specialist[];

  // Виртуальное поле: получить всех специалистов (populate)
  specialistsPopulated?: Specialist[];

  createdAt?: Date;
  updatedAt?: Date;
}

export const ServiceSchema = SchemaFactory.createForClass(Service);

ServiceSchema.virtual('specialistsPopulated', {
  ref: 'User',
  localField: 'specialists',
  foreignField: '_id',
  justOne: false,
  match: { role: UserRole.SPECIALIST },
});
