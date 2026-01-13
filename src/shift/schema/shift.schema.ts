import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Document, Types } from 'mongoose';

@Schema({
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})
export class Shift extends Document {
  @Prop({ type: String, maxlength: 255 })
  name: string;

  @Prop({ type: String, maxlength: 255 * 2 })
  description?: string;

  @Prop({ type: Boolean, default: true })
  default: boolean;

  @Prop({ type: [Number], required: true, default: [] })
  slots: number[];

  @Prop({ type: [Number], required: true, default: [] })
  breakSlots: number[];

  @Prop({ type: String, maxlength: 7, default: '#7c7c7c' })
  color: string;

  @Prop({
    type: Types.ObjectId,
    ref: 'Company',
    required: true, // добавьте required, чтобы смена всегда имела компанию
    index: true,
  })
  company: Types.ObjectId;

  @Prop({ type: Date })
  date?: Date;

  createdAt?: Date;
  updatedAt?: Date;

  // specialist: number;  TODO
}

export type ShiftDocument = HydratedDocument<Shift>;

export const ShiftSchema = SchemaFactory.createForClass(Shift);
