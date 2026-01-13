import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Document, Types } from 'mongoose';
import { Service } from 'src/services/schema/services.schema';
import { Specialist } from 'src/specialists/schema/specialists.schema';

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
  @Prop({
    type: Types.ObjectId,
    ref: 'Company',
    required: true, // добавьте required, чтобы смена всегда имела компанию
    index: true,
  })
  company: Types.ObjectId;

  @Prop({ type: Object, required: true, index: true })
  specialist: Specialist;

  @Prop({ type: [Object], required: true, index: true })
  services: Service[];

  @Prop({ type: Object, required: true, index: true })
  customer: {
    email: string;
    first_name: string;
    last_name: string;
  };

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
