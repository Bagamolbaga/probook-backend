/* eslint-disable @typescript-eslint/ban-ts-comment */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Company } from '../../companies/schema/company.schema';

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
export class ServiceCategory extends Document {
  @Prop({ type: String, required: true, trim: true, maxlength: 255 })
  name: string;

  @Prop({ type: String, required: true })
  normalizedName: string;

  @Prop({ type: Types.ObjectId, ref: Company.name, default: null })
  company: Types.ObjectId | Company | null;

  createdAt?: Date;
  updatedAt?: Date;
}

export const ServiceCategorySchema =
  SchemaFactory.createForClass(ServiceCategory);

ServiceCategorySchema.index(
  { company: 1, normalizedName: 1 },
  { unique: true },
);
