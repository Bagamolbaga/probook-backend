import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { Document, HydratedDocument, Types } from 'mongoose';
import { User } from '../../user/schema/user.schema';
import { Service } from '../../services/schema/services.schema';
// import { Shift } from '../../shifts/schemas/shift.schema';

export type CompanyDocument = HydratedDocument<Company>;

const DEFAULT_WORKING_SCHEDULE = {
  Monday: {
    workingSlots: [
      36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53,
      54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71,
      72,
    ],
    breakSlots: [48, 49, 50, 51, 52],
  },
  Tuesday: {
    workingSlots: [
      36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53,
      54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71,
      72,
    ],
    breakSlots: [48, 49, 50, 51, 52],
  },
  Wednesday: {
    workingSlots: [
      36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53,
      54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71,
      72,
    ],
    breakSlots: [48, 49, 50, 51, 52],
  },
  Thursday: {
    workingSlots: [
      36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53,
      54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71,
      72,
    ],
    breakSlots: [48, 49, 50, 51, 52],
  },
  Friday: {
    workingSlots: [
      36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53,
      54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71,
      72,
    ],
    breakSlots: [48, 49, 50, 51, 52],
  },
  Saturday: { workingSlots: [], breakSlots: [] },
  Sunday: { workingSlots: [], breakSlots: [] },
};

type WorkingSchedule = typeof DEFAULT_WORKING_SCHEDULE;

@Schema({
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})
export class Company extends Document {
  @Prop({ type: String, maxlength: 255 })
  accountId?: string; //beatiful account id string like "BCG-123-HGYR"

  // Один-владелец (One-to-One). В MongoDB делаем через ref + unique индекс если нужно строгость
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    sparse: true,
  })
  owner?: Types.ObjectId | User;

  @Prop({ required: true, maxlength: 250 })
  name: string;

  @Prop({ default: '' })
  description: string;

  @Prop({
    type: String,
    enum: ['created', 'activated', 'deactivated'],
    default: 'created',
  })
  status: string;

  @Prop({ required: false })
  businessType: string;

  @Prop({
    required: false,
  })
  phone: string;

  @Prop({ type: Number, default: 25 })
  staffLimit: number;

  @Prop({ maxlength: 250 })
  address?: string;

  @Prop({ maxlength: 12 })
  zipCode?: string;

  @Prop({ maxlength: 250 })
  city?: string;

  // JSON-поле с координатами
  @Prop(
    raw({
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    }),
  )
  pos?: Record<string, any>;

  // Дефолтное расписание
  @Prop({ type: Object, default: () => ({ ...DEFAULT_WORKING_SCHEDULE }) })
  workingSchedule: WorkingSchedule;

  // @Prop({
  //   type: [{ type: Types.ObjectId, ref: 'Service' }],
  //   default: [],
  // })
  services: Service[];

  // servicesPopulated: Service[];

  // Путь к логотипу
  @Prop()
  logo?: string;

  // Many-to-Many с Shift
  // @Prop({
  //   type: [Types.ObjectId],
  //   ref: 'Shift',
  //   default: [],
  // })
  // shifts: Types.ObjectId[];

  // Виртуальное поле для изображений (populate)
  images?: [];

  createdAt?: Date;
  updatedAt?: Date;
}

export const CompanySchema = SchemaFactory.createForClass(Company);

// Индексы как в Django
CompanySchema.index({ createdAt: -1 });
CompanySchema.index({ name: 1 });

CompanySchema.virtual('services', {
  ref: 'Service',
  localField: '_id',
  foreignField: 'company',
  justOne: false,
});
