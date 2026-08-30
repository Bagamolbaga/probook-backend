import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument, Types } from 'mongoose';

export enum ScheduleType {
  WEEKLY = 'weekly',
  CYCLE = 'cycle',
}

@Schema({ _id: false })
export class ScheduleDay {
  @Prop({ type: Number, required: true, min: 0 })
  day: number;

  @Prop({ type: Types.ObjectId, ref: 'Shift', default: null })
  shift: Types.ObjectId | null;
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
export class Schedule extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Company', required: true, index: true })
  company: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  specialist: Types.ObjectId;

  @Prop({ type: String, enum: ScheduleType, default: ScheduleType.WEEKLY })
  type: ScheduleType;

  @Prop({ type: Date, required: true })
  activeFrom: Date;

  @Prop({ type: Date, default: null })
  activeTo?: Date | null;

  @Prop({ type: Number, min: 1 })
  cycleLengthDays?: number;

  @Prop({ type: [ScheduleDay], default: [] })
  days: ScheduleDay[];

  createdAt?: Date;
  updatedAt?: Date;
}

export type ScheduleDocument = HydratedDocument<Schedule>;

export const ScheduleSchema = SchemaFactory.createForClass(Schedule);

ScheduleSchema.index({ company: 1, specialist: 1, activeFrom: 1, activeTo: 1 });
