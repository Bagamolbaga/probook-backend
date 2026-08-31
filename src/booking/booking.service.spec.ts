import { Types } from 'mongoose';

jest.mock('../availability/availability.service', () => ({
  AvailabilityService: class AvailabilityService {},
}));

import { BookingService } from './booking.service';

describe('BookingService', () => {
  it('stores immutable entity snapshots when creating a booking', async () => {
    const companyId = new Types.ObjectId();
    const specialistId = new Types.ObjectId();
    const serviceId = new Types.ObjectId();
    const optionId = new Types.ObjectId();
    const customerId = new Types.ObjectId();
    const ownerId = new Types.ObjectId();
    const bookingId = new Types.ObjectId();
    const savedBooking = {
      _id: bookingId,
      customer: { firstName: 'Jane', lastName: 'Doe' },
      specialist: { fullName: 'Sam Smith' },
      services: [{ name: 'Haircut' }],
      date: '2026-08-27',
      slots: [10, 11],
      totalPrice: 50,
      status: 'PENDING',
    };
    const save = jest.fn().mockResolvedValue(savedBooking);
    const bookingModel = jest
      .fn()
      .mockImplementation((data) => ({ ...data, save }));
    const serviceQuery = { populate: jest.fn(), lean: jest.fn() };
    serviceQuery.populate.mockReturnValue(serviceQuery);
    serviceQuery.lean.mockResolvedValue([
      {
        _id: serviceId,
        name: 'Haircut',
        options: [
          {
            _id: optionId,
            name: 'Standard',
            price: 50,
            duration: 60,
          },
        ],
        category: { _id: new Types.ObjectId(), name: 'Hair' },
      },
    ]);
    const serviceModel = { find: jest.fn().mockReturnValue(serviceQuery) };
    const specialistModel = {
      findById: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: specialistId,
          email: 'specialist@example.com',
          firstName: 'Sam',
          lastName: 'Smith',
          specialties: ['Hair'],
        }),
      }),
    };
    const companyModel = {
      findById: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: companyId,
          owner: ownerId,
          name: 'Studio',
          description: 'Description',
        }),
      }),
    };
    const availabilityService = {
      assertSlotsAreBookable: jest.fn().mockResolvedValue(undefined),
    };
    const userService = {
      findOrCreateCustomer: jest.fn().mockResolvedValue({
        _id: customerId,
        email: 'customer@example.com',
        firstName: 'Jane',
        lastName: 'Doe',
        avatar: null,
      }),
    };
    const notificationService = { notifyUser: jest.fn() };
    const service = new BookingService(
      bookingModel as any,
      serviceModel as any,
      specialistModel as any,
      companyModel as any,
      availabilityService as any,
      userService as any,
      notificationService as any,
    );

    await expect(
      service.createBooking({
        company: companyId,
        specialist: specialistId,
        services: [{ serviceId, optionId }],
        customer: {
          email: ' Customer@Example.com ',
          first_name: 'Jane',
          last_name: 'Doe',
        },
        date: '2026-08-27',
        slots: [10, 11],
      }),
    ).resolves.toBe(savedBooking);

    expect(userService.findOrCreateCustomer).toHaveBeenCalledWith({
      email: ' Customer@Example.com ',
      firstName: 'Jane',
      lastName: 'Doe',
    });
    expect(bookingModel).toHaveBeenCalledWith(
      expect.objectContaining({
        company: expect.objectContaining({ _id: companyId, name: 'Studio' }),
        specialist: expect.objectContaining({
          _id: specialistId,
          firstName: 'Sam',
        }),
        services: [
          expect.objectContaining({
            _id: serviceId,
            name: 'Haircut',
            selectedOption: expect.objectContaining({
              _id: optionId,
              price: 50,
            }),
          }),
        ],
        totalPrice: 50,
        customer: expect.objectContaining({
          _id: customerId,
          email: 'customer@example.com',
        }),
      }),
    );
    expect(save).toHaveBeenCalledTimes(1);
    expect(notificationService.notifyUser).toHaveBeenCalledWith(
      ownerId,
      'booking.created',
      {
        bookingId: bookingId.toString(),
        companyId: companyId.toString(),
        companyName: 'Studio',
        customerName: 'Jane Doe',
        specialistName: 'Sam Smith',
        serviceNames: ['Haircut'],
        date: '2026-08-27',
        slots: [10, 11],
        totalPrice: 50,
        status: 'PENDING',
      },
    );
  });

  it('filters and paginates bookings using the frontend query contract', async () => {
    const companyId = new Types.ObjectId();
    const specialistId = new Types.ObjectId();
    const bookings = [{ id: 'booking-id' }];
    const query: Record<string, jest.Mock> = {
      sort: jest.fn(),
      skip: jest.fn(),
      limit: jest.fn(),
      exec: jest.fn(),
    };
    query.sort.mockReturnValue(query);
    query.skip.mockReturnValue(query);
    query.limit.mockReturnValue(query);
    query.exec.mockResolvedValue(bookings);
    const bookingModel = {
      countDocuments: jest.fn().mockResolvedValue(12),
      find: jest.fn().mockReturnValue(query),
    };
    const service = new BookingService(
      bookingModel as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.getBookings({
        companyId,
        specialistId,
        startDate: '2026-08-01',
        endDate: '2026-08-31',
        offset: 10,
        limit: 25,
      }),
    ).resolves.toEqual({
      count: 12,
      next: null,
      previous: null,
      results: bookings,
    });

    const filters = {
      'company._id': expect.objectContaining({}),
      'specialist._id': expect.objectContaining({}),
      date: { $gte: '2026-08-01', $lte: '2026-08-31' },
    };
    expect(bookingModel.countDocuments).toHaveBeenCalledWith(filters);
    expect(bookingModel.find).toHaveBeenCalledWith(filters);
    expect(query.sort).toHaveBeenCalledWith({ date: 1, createdAt: 1 });
    expect(query.skip).toHaveBeenCalledWith(10);
    expect(query.limit).toHaveBeenCalledWith(25);
  });

  it('returns the minimal booking projection with the same filters', async () => {
    const companyId = new Types.ObjectId();
    const bookings = [{ id: 'booking-id' }];
    const query: Record<string, jest.Mock> = {
      select: jest.fn(),
      sort: jest.fn(),
      exec: jest.fn(),
      skip: jest.fn(),
      limit: jest.fn(),
    };
    query.select.mockReturnValue(query);
    query.sort.mockReturnValue(query);
    query.skip.mockReturnValue(query);
    query.limit.mockReturnValue(query);
    query.exec.mockResolvedValue(bookings);
    const bookingModel = {
      countDocuments: jest.fn().mockResolvedValue(1),
      find: jest.fn().mockReturnValue(query),
    };
    const service = new BookingService(
      bookingModel as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.getBookingsMin({
        companyId,
        startDate: '2026-08-30',
        endDate: '2026-08-30',
      }),
    ).resolves.toEqual({
      count: 1,
      next: null,
      previous: null,
      results: bookings,
    });

    const filters = {
      'company._id': expect.objectContaining({}),
      date: { $gte: '2026-08-30', $lte: '2026-08-30' },
    };
    expect(bookingModel.find).toHaveBeenCalledWith(filters);
    expect(query.select).toHaveBeenCalledWith(
      'id specialist date slots status company',
    );
    expect(query.skip).not.toHaveBeenCalled();
    expect(query.limit).not.toHaveBeenCalled();
  });

  it('returns one booking scoped to its company', async () => {
    const companyId = new Types.ObjectId();
    const bookingId = new Types.ObjectId();
    const booking = { id: bookingId.toString() };
    const exec = jest.fn().mockResolvedValue(booking);
    const bookingModel = {
      findOne: jest.fn().mockReturnValue({ exec }),
    };
    const service = new BookingService(
      bookingModel as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(service.getBooking({ companyId, bookingId })).resolves.toBe(
      booking,
    );
    expect(bookingModel.findOne).toHaveBeenCalledWith({
      _id: expect.objectContaining({}),
      'company._id': expect.objectContaining({}),
    });
  });

  it('rejects a booking that does not belong to the company', async () => {
    const companyId = new Types.ObjectId();
    const bookingId = new Types.ObjectId();
    const bookingModel = {
      findOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      }),
    };
    const service = new BookingService(
      bookingModel as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(service.getBooking({ companyId, bookingId })).rejects.toThrow(
      'Booking not found',
    );
  });

  it('updates booking snapshots, price, schedule, and status', async () => {
    const companyId = new Types.ObjectId();
    const bookingId = new Types.ObjectId();
    const specialistId = new Types.ObjectId();
    const serviceId = new Types.ObjectId();
    const optionId = new Types.ObjectId();
    const booking = {
      specialist: null,
      services: [],
      totalPrice: 0,
      date: '2026-08-30',
      slots: [40, 41],
      status: 'PENDING',
      save: jest.fn(),
    };
    booking.save.mockResolvedValue(booking);
    const bookingModel = {
      findOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(booking),
      }),
    };
    const specialist = {
      _id: specialistId,
      company: companyId,
      email: 'specialist@example.com',
      firstName: 'Sam',
      lastName: 'Smith',
      avatar: null,
      specialties: ['Hair'],
      services: [serviceId],
    };
    const specialistModel = {
      findOne: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(specialist),
      }),
    };
    const serviceQuery = {
      populate: jest.fn(),
      lean: jest.fn(),
    };
    serviceQuery.populate.mockReturnValue(serviceQuery);
    serviceQuery.lean.mockResolvedValue([
      {
        _id: serviceId,
        name: 'Haircut',
        company: companyId,
        category: new Types.ObjectId(),
        specialists: [specialistId],
        options: [
          {
            _id: optionId,
            name: 'Standard',
            price: 75,
            duration: 30,
          },
        ],
      },
    ]);
    const serviceModel = {
      find: jest.fn().mockReturnValue(serviceQuery),
    };
    const availabilityService = {
      assertSlotsAreBookable: jest.fn().mockResolvedValue(undefined),
    };
    const service = new BookingService(
      bookingModel as any,
      serviceModel as any,
      specialistModel as any,
      {} as any,
      availabilityService as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.updateBooking({
        companyId,
        bookingId,
        specialistId: specialistId.toString(),
        services: [
          {
            serviceId: serviceId.toString(),
            optionId: optionId.toString(),
          },
        ],
        date: '2026-09-01',
        slots: [44, 45],
        status: 'CONFIRMED' as any,
      }),
    ).resolves.toBe(booking);

    expect(availabilityService.assertSlotsAreBookable).toHaveBeenCalledWith({
      companyId: companyId.toString(),
      specialistId: specialistId.toString(),
      date: '2026-09-01',
      slots: [44, 45],
      excludeBookingId: bookingId.toString(),
    });
    expect(booking).toEqual(
      expect.objectContaining({
        specialist: expect.objectContaining({ id: specialistId.toString() }),
        services: [
          expect.objectContaining({
            id: serviceId.toString(),
            selectedOption: expect.objectContaining({
              id: optionId.toString(),
            }),
          }),
        ],
        totalPrice: 75,
        date: '2026-09-01',
        slots: [44, 45],
        status: 'CONFIRMED',
      }),
    );
    expect(booking.save).toHaveBeenCalledTimes(1);
  });

  it('rejects update slots that do not cover the selected duration', async () => {
    const companyId = new Types.ObjectId();
    const bookingId = new Types.ObjectId();
    const specialistId = new Types.ObjectId();
    const serviceId = new Types.ObjectId();
    const optionId = new Types.ObjectId();
    const bookingModel = {
      findOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ save: jest.fn() }),
      }),
    };
    const specialistModel = {
      findOne: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: specialistId,
          email: 'specialist@example.com',
          firstName: 'Sam',
          lastName: 'Smith',
          specialties: [],
          services: [serviceId],
        }),
      }),
    };
    const serviceQuery = {
      populate: jest.fn(),
      lean: jest.fn(),
    };
    serviceQuery.populate.mockReturnValue(serviceQuery);
    serviceQuery.lean.mockResolvedValue([
      {
        _id: serviceId,
        name: 'Haircut',
        category: new Types.ObjectId(),
        specialists: [specialistId],
        options: [{ _id: optionId, price: 75, duration: 60 }],
      },
    ]);
    const availabilityService = {
      assertSlotsAreBookable: jest.fn(),
    };
    const service = new BookingService(
      bookingModel as any,
      { find: jest.fn().mockReturnValue(serviceQuery) } as any,
      specialistModel as any,
      {} as any,
      availabilityService as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.updateBooking({
        companyId,
        bookingId,
        specialistId: specialistId.toString(),
        services: [
          {
            serviceId: serviceId.toString(),
            optionId: optionId.toString(),
          },
        ],
        date: '2026-09-01',
        slots: [44, 45],
        status: 'CONFIRMED' as any,
      }),
    ).rejects.toThrow('Booking slots do not match selected service duration');
    expect(availabilityService.assertSlotsAreBookable).not.toHaveBeenCalled();
  });

  it('sums completed booking totals in the customer list', async () => {
    const companyId = new Types.ObjectId();
    const exec = jest.fn().mockResolvedValue([]);
    const aggregate = jest.fn().mockReturnValue({ exec });
    const service = new BookingService(
      { aggregate } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await service.getBookingsCustomers({ companyId });

    expect(aggregate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          $group: expect.objectContaining({
            moneySpent: {
              $sum: {
                $cond: [
                  { $eq: ['$status', 'COMPLETED'] },
                  { $ifNull: ['$totalPrice', 0] },
                  0,
                ],
              },
            },
          }),
        }),
      ]),
    );
  });

  it('returns the latest customer snapshot with booking statistics', async () => {
    const companyId = new Types.ObjectId();
    const customerId = new Types.ObjectId();
    const firstBooking = new Date('2026-08-01T10:00:00.000Z');
    const lastBooking = new Date('2026-08-27T10:00:00.000Z');
    const moneySpent = 125;
    const customer = {
      _id: customerId,
      id: customerId.toString(),
      email: 'customer@example.com',
      firstName: 'Jane',
      lastName: 'Doe',
    };
    const bookingModel = {
      aggregate: jest.fn().mockResolvedValue([
        {
          customer,
          bookingsCount: 3,
          firstBooking,
          lastBooking,
          moneySpent,
        },
      ]),
    };
    const service = new BookingService(
      bookingModel as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.getCustomerDetails({ companyId, customerId }),
    ).resolves.toEqual({
      ...customer,
      bookingsCount: 3,
      firstBooking,
      lastBooking,
      moneySpent,
    });

    expect(bookingModel.aggregate).toHaveBeenCalledWith(
      expect.arrayContaining([
        {
          $match: {
            'company._id': expect.objectContaining({}),
            'customer._id': expect.objectContaining({}),
          },
        },
      ]),
    );
    expect(bookingModel.aggregate.mock.calls[0][0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          $group: expect.objectContaining({
            moneySpent: {
              $sum: {
                $cond: [
                  { $eq: ['$status', 'COMPLETED'] },
                  { $ifNull: ['$totalPrice', 0] },
                  0,
                ],
              },
            },
          }),
        }),
      ]),
    );
  });

  it('returns paginated history filtered by embedded snapshot ids', async () => {
    const companyId = new Types.ObjectId();
    const customerId = new Types.ObjectId();
    const bookings = [{ id: 'booking-id' }];
    const query: Record<string, jest.Mock> = {
      sort: jest.fn(),
      skip: jest.fn(),
      limit: jest.fn(),
    };
    query.sort.mockReturnValue(query);
    query.skip.mockReturnValue(query);
    query.limit.mockResolvedValue(bookings);
    const bookingModel = {
      countDocuments: jest.fn().mockResolvedValue(1),
      find: jest.fn().mockReturnValue(query),
    };
    const service = new BookingService(
      bookingModel as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.getCustomerBookings({
        companyId,
        customerId,
        offset: '20',
        limit: '10',
        ordering: '-date',
      }),
    ).resolves.toEqual({
      count: 1,
      next: null,
      previous: null,
      results: bookings,
    });

    const filters = {
      'company._id': expect.objectContaining({}),
      'customer._id': expect.objectContaining({}),
    };
    expect(bookingModel.countDocuments).toHaveBeenCalledWith(filters);
    expect(bookingModel.find).toHaveBeenCalledWith(filters);
    expect(query.sort).toHaveBeenCalledWith({ date: -1 });
    expect(query.skip).toHaveBeenCalledWith(20);
    expect(query.limit).toHaveBeenCalledWith(10);
  });
});
