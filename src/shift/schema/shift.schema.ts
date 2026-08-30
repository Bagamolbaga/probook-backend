import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Document, Types } from 'mongoose';

export enum ShiftKind {
  DEFAULT = 'default',
  OVERRIDE = 'override',
}

@Schema({
  timestamps: true,
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret) => {
      const obj = ret as Record<string, any>;
      obj.id = obj._id.toHexString();
      delete obj._id;
      return ret;
    },
  },
  toObject: {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret) => {
      const obj = ret as Record<string, any>;
      obj.id = obj._id.toHexString();
      delete obj._id;
      return ret;
    },
  },
})
export class Shift extends Document {
  @Prop({ type: String, maxlength: 255 })
  name: string;

  @Prop({ type: String, maxlength: 255 * 2 })
  description?: string;

  @Prop({ type: String, enum: ShiftKind, default: ShiftKind.DEFAULT })
  kind: ShiftKind;

  @Prop({ type: [Number], required: true, default: [] })
  workingSlots: number[];

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

  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    default: null,
    index: true,
  })
  specialist?: Types.ObjectId | null;

  @Prop({ type: Date })
  date?: Date | null;

  createdAt?: Date;
  updatedAt?: Date;
}

export type ShiftDocument = HydratedDocument<Shift>;

export const ShiftSchema = SchemaFactory.createForClass(Shift);

ShiftSchema.index({ company: 1, kind: 1 });
ShiftSchema.index(
  { company: 1, specialist: 1, date: 1 },
  {
    unique: true,
    partialFilterExpression: {
      specialist: { $exists: true, $ne: null },
      date: { $exists: true, $ne: null },
    },
  },
);
