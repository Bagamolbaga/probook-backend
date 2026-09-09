import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Document, Types } from 'mongoose';

export type BookingCompanySnapshot = {
  _id: Types.ObjectId;
  id: string;
  name: string;
  description?: string;
  businessType?: string;
  phone?: string;
  address?: string;
  zipCode?: string;
  city?: string;
  pos?: Record<string, unknown>;
  logo?: string;
};

export type BookingSpecialistSnapshot = {
  _id: Types.ObjectId;
  id: string;
  userId: Types.ObjectId;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  avatar?: string | null;
  specialties: string[];
  bio?: string;
  rating?: number;
};

export type BookingServiceSnapshot = {
  _id: Types.ObjectId;
  id: string;
  name: string;
  description?: string;
  image?: string;
  category?: {
    _id: Types.ObjectId;
    id: string;
    name: string;
  };
  options: Array<{
    _id: Types.ObjectId;
    id: string;
    name?: string;
    description?: string;
    price: number;
    duration: number;
  }>;
  selectedOption: {
    _id: Types.ObjectId;
    id: string;
    name?: string;
    description?: string;
    price: number;
    duration: number;
  };
};

export type BookingCustomerSnapshot = {
  _id: Types.ObjectId;
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string | null;
  phone?: string;
};

export enum BookingStatus {
  BLOCKED = 'BLOCKED',
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  OFF = 'OFF',
  CONFIRMED = 'CONFIRMED',
}

@Schema({
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})
export class Booking extends Document {
  @Prop({ type: Object, required: true })
  company: BookingCompanySnapshot;

  @Prop({ type: Object, required: true })
  specialist: BookingSpecialistSnapshot;

  @Prop({ type: [Object], required: true })
  services: BookingServiceSnapshot[];

  @Prop({ type: Number, required: true, min: 0 })
  totalPrice: number;

  @Prop({ type: Object, required: true })
  customer: BookingCustomerSnapshot;

  @Prop({ required: true })
  date: string;

  @Prop({ type: [Number], required: true })
  slots: number[];

  @Prop({
    type: String,
    enum: BookingStatus,
    default: BookingStatus.PENDING,
    required: true,
  })
  status: BookingStatus;

  createdAt?: Date;
  updatedAt?: Date;
}

export type BookingDocument = HydratedDocument<Booking>;

export const BookingSchema = SchemaFactory.createForClass(Booking);

BookingSchema.index({ 'company._id': 1, date: 1, status: 1 });
BookingSchema.index({
  'company._id': 1,
  'specialist._id': 1,
  date: 1,
  status: 1,
});
BookingSchema.index({ 'customer._id': 1, date: -1 });
BookingSchema.index({ 'company._id': 1, 'customer.email': 1 });
