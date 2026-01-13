import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Booking } from './schema/booking.schema';
import { Company } from 'src/companies/schema/company.schema';
import { Specialist } from 'src/specialists/schema/specialists.schema';
import { Service } from 'src/services/schema/services.schema';
import { UserRole } from 'src/user/schema/user.schema';

type SafetyBooking = Omit<Booking, 'id' | '_id'>;
export type CreateBookingDto = Partial<SafetyBooking>;
export type UpdateBookingDto = Partial<SafetyBooking>;
export type GetBookingsDto = {
  companyId: Company['_id'];
  specialist?: Specialist['_id'];
  date?: Date;
};

@Injectable()
export class BookingService {
  constructor(
    @InjectModel(Booking.name) private bookingModel: Model<Booking>,
    @InjectModel(Service.name) private serviceModel: Model<Service>,
    @InjectModel(UserRole.SPECIALIST)
    private specialistModel: Model<Specialist>,
  ) {}

  async createBooking(dto: CreateBookingDto) {
    const services = await this.serviceModel.find({
      _id: { $in: dto.services as unknown as Types.ObjectId[] },
    });

    const specialist = await this.specialistModel
      .findById(dto.specialist as unknown as Types.ObjectId)
      .lean();

    const booking = new this.bookingModel({
      ...dto,
      company: new Types.ObjectId(dto.company) as unknown as string,
      services: services,
      specialist,
    });
    return booking.save();
  }

  async getBookings(dto: GetBookingsDto) {
    const booking = await this.bookingModel.find({
      company: new Types.ObjectId(dto.companyId as unknown as string),
    });
    return booking;
  }

  async getBookingsMin(dto: GetBookingsDto) {
    const booking = await this.bookingModel
      .find({ company: new Types.ObjectId(dto.companyId as unknown as string) })
      .select('id specialist date slots status')
      .populate('company');
    return booking;
  }

  async getBookingsCustomers(dto: Pick<GetBookingsDto, 'companyId'>) {
    const uniqueCustomers = await this.bookingModel
      .aggregate([
        {
          $match: {
            company: new Types.ObjectId(dto.companyId as unknown as string), // ← вот так!
          },
        }, // опционально фильтр по компании

        {
          $group: {
            _id: '$customer.email', // группируем по email (уникальный ключ)
            customer: { $first: '$customer' }, // берём первое вхождение объекта customer
            bookingsCount: { $sum: 1 }, // сколько раз этот клиент записывался
            lastBookingDate: { $max: '$createdAt' }, // дата последней записи
          },
        },

        {
          $replaceRoot: {
            newRoot: {
              $mergeObjects: [
                '$customer',
                {
                  id: '$customer.email',
                  bookingsCount: '$bookingsCount',
                  lastBooking: '$lastBookingDate',
                  moneySpent: 0,
                },
              ],
            },
          },
        },

        // { $sort: { lastBooking: -1 } }, // сортировка по последней записи
      ])
      .exec();

    return uniqueCustomers as Booking['customer'] &
      { bookingsCount: number; lastBookingDate: Date }[];
  }
}
