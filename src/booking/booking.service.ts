import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Booking,
  BookingCompanySnapshot,
  BookingCustomerSnapshot,
  BookingServiceSnapshot,
  BookingSpecialistSnapshot,
  BookingStatus,
} from './schema/booking.schema';
import { Company } from '../companies/schema/company.schema';
import { Specialist } from '../specialists/schema/specialists.schema';
import { Service } from '../services/schema/services.schema';
import { User, UserRole } from '../user/schema/user.schema';
import { AvailabilityService } from '../availability/availability.service';
import { UserService } from '../user/user.service';

type BookingCustomerInput = {
  email: string;
  first_name: string;
  last_name: string;
};
type BookingServiceInput = {
  serviceId: Service['_id'];
  optionId: Types.ObjectId | string;
};
export type CreateBookingDto = {
  company: Company['_id'];
  specialist: Specialist['_id'];
  services: BookingServiceInput[];
  customer: BookingCustomerInput;
  date: string;
  slots: number[];
  status?: BookingStatus;
};
export type GetBookingsDto = {
  companyId: Company['_id'];
  specialist?: Specialist['_id'];
  date?: Date;
};
export type GetCustomerDto = {
  companyId: Company['_id'];
  customerId: User['_id'];
};
export type GetCustomerBookingsDto = GetCustomerDto & {
  offset?: string;
  limit?: string;
  ordering?: string;
};

@Injectable()
export class BookingService {
  constructor(
    @InjectModel(Booking.name) private bookingModel: Model<Booking>,
    @InjectModel(Service.name) private serviceModel: Model<Service>,
    @InjectModel(UserRole.SPECIALIST)
    private specialistModel: Model<Specialist>,
    @InjectModel(Company.name) private companyModel: Model<Company>,
    private availabilityService: AvailabilityService,
    private userService: UserService,
  ) {}

  async createBooking(dto: CreateBookingDto) {
    const companyId = this.toObjectId(dto.company);
    const specialistId = this.toObjectId(dto.specialist);
    const serviceSelections = dto.services.map((selection) => ({
      serviceId: this.toObjectId(selection.serviceId, 'Service not found'),
      optionId: this.toObjectId(selection.optionId, 'Service option not found'),
    }));
    const uniqueServiceIds = [
      ...new Map(
        serviceSelections.map(({ serviceId }) => [
          serviceId.toString(),
          serviceId,
        ]),
      ).values(),
    ];

    const [company, specialist, services] = await Promise.all([
      this.companyModel.findById(companyId).lean(),
      this.specialistModel.findById(specialistId).lean(),
      this.serviceModel
        .find({ _id: { $in: uniqueServiceIds }, company: companyId })
        .populate('category')
        .lean(),
      this.availabilityService.assertSlotsAreBookable({
        companyId: companyId.toString(),
        specialistId: specialistId.toString(),
        date: dto.date,
        slots: dto.slots,
      }),
    ]);

    if (!company) throw new NotFoundException('Company not found');
    if (!specialist) throw new NotFoundException('Specialist not found');
    if (services.length !== uniqueServiceIds.length) {
      throw new NotFoundException('Service not found');
    }

    const serviceSnapshots = serviceSelections.map(
      ({ serviceId, optionId }) => {
        const service = services.find((item) => item._id.equals(serviceId));
        const selectedOption = service?.options.find((option) =>
          this.getServiceOptionId(option).equals(optionId),
        );

        if (!service) throw new NotFoundException('Service not found');
        if (!selectedOption) {
          throw new NotFoundException('Service option not found');
        }

        return this.toServiceSnapshot(service, selectedOption);
      },
    );
    const totalPrice = serviceSnapshots.reduce(
      (sum, service) => sum + service.selectedOption.price,
      0,
    );

    const customer = await this.userService.findOrCreateCustomer({
      email: dto.customer.email,
      firstName: dto.customer.first_name,
      lastName: dto.customer.last_name,
    });

    const booking = new this.bookingModel({
      ...dto,
      company: this.toCompanySnapshot(company),
      services: serviceSnapshots,
      totalPrice,
      specialist: this.toSpecialistSnapshot(specialist),
      customer: this.toCustomerSnapshot(customer),
    });
    return booking.save();
  }

  async getBookings(dto: GetBookingsDto) {
    const booking = await this.bookingModel.find({
      'company._id': this.toObjectId(dto.companyId),
    });
    return booking;
  }

  async getBookingsMin(dto: GetBookingsDto) {
    const booking = await this.bookingModel
      .find({ 'company._id': this.toObjectId(dto.companyId) })
      .select('id specialist date slots status company');
    return booking;
  }

  async getBookingsCustomers(dto: Pick<GetBookingsDto, 'companyId'>) {
    const uniqueCustomers = await this.bookingModel
      .aggregate([
        {
          $match: {
            'company._id': this.toObjectId(dto.companyId),
          },
        },
        { $sort: { createdAt: -1 } },
        {
          $group: {
            _id: '$customer._id',
            customer: { $first: '$customer' },
            bookingsCount: { $sum: 1 },
            lastBooking: { $max: '$createdAt' },
            moneySpent: {
              $sum: {
                $cond: [
                  { $eq: ['$status', BookingStatus.COMPLETED] },
                  { $ifNull: ['$totalPrice', 0] },
                  0,
                ],
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            id: '$customer._id',
            email: '$customer.email',
            firstName: '$customer.firstName',
            lastName: '$customer.lastName',
            phone: '$customer.phone',
            avatar: '$customer.avatar',
            bookingsCount: 1,
            lastBooking: 1,
            moneySpent: 1,
          },
        },
      ])
      .exec();

    return uniqueCustomers as Array<
      Pick<User, 'email' | 'firstName' | 'lastName' | 'avatar'> & {
        id: Types.ObjectId;
        phone?: string;
        bookingsCount: number;
        lastBooking: Date;
        moneySpent: number;
      }
    >;
  }

  async getCustomerDetails(dto: GetCustomerDto) {
    const companyId = this.toObjectId(dto.companyId, 'Customer not found');
    const customerId = this.toObjectId(dto.customerId, 'Customer not found');

    const stats = await this.bookingModel.aggregate<{
      customer: BookingCustomerSnapshot;
      bookingsCount: number;
      firstBooking: Date;
      lastBooking: Date;
      moneySpent: number;
    }>([
      {
        $match: {
          'company._id': companyId,
          'customer._id': customerId,
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$customer._id',
          customer: { $first: '$customer' },
          bookingsCount: { $sum: 1 },
          firstBooking: { $min: '$createdAt' },
          lastBooking: { $max: '$createdAt' },
          moneySpent: {
            $sum: {
              $cond: [
                { $eq: ['$status', BookingStatus.COMPLETED] },
                { $ifNull: ['$totalPrice', 0] },
                0,
              ],
            },
          },
        },
      },
    ]);

    if (!stats[0]) {
      throw new NotFoundException('Customer not found');
    }

    return {
      ...stats[0].customer,
      bookingsCount: stats[0].bookingsCount,
      firstBooking: stats[0].firstBooking,
      lastBooking: stats[0].lastBooking,
      moneySpent: stats[0].moneySpent,
    };
  }

  async getCustomerBookings(dto: GetCustomerBookingsDto) {
    const companyId = this.toObjectId(dto.companyId, 'Customer not found');
    const customerId = this.toObjectId(dto.customerId, 'Customer not found');
    const offset = this.toNonNegativeInteger(dto.offset, 0);
    const limit = Math.min(
      Math.max(this.toNonNegativeInteger(dto.limit, 10), 1),
      100,
    );
    const sort = this.getCustomerBookingsSort(dto.ordering);
    const filters = {
      'company._id': companyId,
      'customer._id': customerId,
    };

    const [count, bookings] = await Promise.all([
      this.bookingModel.countDocuments(filters),
      this.bookingModel.find(filters).sort(sort).skip(offset).limit(limit),
    ]);

    if (!count) {
      throw new NotFoundException('Customer not found');
    }

    return {
      count,
      next: null,
      previous: null,
      results: bookings,
    };
  }

  private toCompanySnapshot(company: Company): BookingCompanySnapshot {
    return {
      _id: company._id,
      id: company._id.toString(),
      name: company.name,
      description: company.description,
      businessType: company.businessType,
      phone: company.phone,
      address: company.address,
      zipCode: company.zipCode,
      city: company.city,
      pos: company.pos,
      logo: company.logo,
    };
  }

  private toSpecialistSnapshot(
    specialist: Specialist,
  ): BookingSpecialistSnapshot {
    return {
      _id: specialist._id,
      id: specialist._id.toString(),
      email: specialist.email,
      firstName: specialist.firstName,
      lastName: specialist.lastName,
      fullName: `${specialist.firstName} ${specialist.lastName}`.trim(),
      avatar: specialist.avatar,
      specialties: specialist.specialties,
      bio: specialist.bio,
      rating: specialist.rating,
    };
  }

  private toServiceSnapshot(
    service: Service,
    selectedOption: Service['options'][number],
  ): BookingServiceSnapshot {
    const category = service.category;
    const categorySnapshot =
      category && !(category instanceof Types.ObjectId)
        ? {
            _id: category._id,
            id: category._id.toString(),
            name: category.name,
          }
        : undefined;

    return {
      _id: service._id,
      id: service._id.toString(),
      name: service.name,
      description: service.description,
      image: service.image,
      category: categorySnapshot,
      options: service.options.map((option) =>
        this.toServiceOptionSnapshot(option),
      ),
      selectedOption: this.toServiceOptionSnapshot(selectedOption),
    };
  }

  private toServiceOptionSnapshot(option: Service['options'][number]) {
    const optionId = this.getServiceOptionId(option);

    return {
      _id: optionId,
      id: optionId.toString(),
      name: option.name,
      description: option.description,
      price: option.price,
      duration: option.duration,
    };
  }

  private getServiceOptionId(option: Service['options'][number]) {
    return (option as Service['options'][number] & { _id: Types.ObjectId })._id;
  }

  private toCustomerSnapshot(customer: User): BookingCustomerSnapshot {
    return {
      _id: customer._id,
      id: customer._id.toString(),
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
      avatar: customer.avatar,
    };
  }

  private toObjectId(
    value: Types.ObjectId | string,
    notFoundMessage = 'Entity not found',
  ) {
    if (!value || !Types.ObjectId.isValid(value.toString())) {
      throw new NotFoundException(notFoundMessage);
    }

    return new Types.ObjectId(value.toString());
  }

  private toNonNegativeInteger(value: string | undefined, fallback: number) {
    const parsedValue = Number(value);
    return Number.isInteger(parsedValue) && parsedValue >= 0
      ? parsedValue
      : fallback;
  }

  private getCustomerBookingsSort(ordering?: string) {
    const descending = ordering?.startsWith('-') ?? true;
    const requestedField = ordering?.replace(/^-/, '') || 'createdAt';
    const fields: Record<string, string> = {
      id: '_id',
      date: 'date',
      createdAt: 'createdAt',
    };
    const field = fields[requestedField] || 'createdAt';

    return { [field]: descending ? -1 : 1 } as Record<string, 1 | -1>;
  }
}
