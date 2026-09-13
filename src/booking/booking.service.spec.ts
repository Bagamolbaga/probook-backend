import { Model, Types } from 'mongoose';

jest.mock('../availability/availability.service', () => ({
  AvailabilityService: class AvailabilityService {},
}));

import { BookingService } from './booking.service';
import { Booking, BookingStatus } from './schema/booking.schema';
import { RealtimeService } from '../notification/realtime.service';

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
            duration: 30,
          },
        ],
        category: { _id: new Types.ObjectId(), name: 'Hair' },
      },
    ]);
    const serviceModel = { find: jest.fn().mockReturnValue(serviceQuery) };
    const specialistQuery = {
      populate: jest.fn(),
      lean: jest.fn().mockResolvedValue({
        _id: specialistId,
        userId: {
          _id: new Types.ObjectId(),
          email: 'specialist@example.com',
          firstName: 'Sam',
          lastName: 'Smith',
        },
        specialties: ['Hair'],
      }),
    };
    specialistQuery.populate.mockReturnValue(specialistQuery);
    const specialistModel = {
      findOne: jest.fn().mockReturnValue(specialistQuery),
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
      userId: {
        _id: new Types.ObjectId(),
        email: 'specialist@example.com',
        firstName: 'Sam',
        lastName: 'Smith',
        avatar: null,
      },
      specialties: ['Hair'],
      services: [serviceId],
    };
    const specialistQuery = {
      populate: jest.fn(),
      lean: jest.fn().mockResolvedValue(specialist),
    };
    specialistQuery.populate.mockReturnValue(specialistQuery);
    const specialistModel = {
      findOne: jest.fn().mockReturnValue(specialistQuery),
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
    const specialistQuery = {
      populate: jest.fn(),
      lean: jest.fn().mockResolvedValue({
        _id: specialistId,
        userId: {
          _id: new Types.ObjectId(),
          email: 'specialist@example.com',
          firstName: 'Sam',
          lastName: 'Smith',
        },
        specialties: [],
        services: [serviceId],
      }),
    };
    specialistQuery.populate.mockReturnValue(specialistQuery);
    const specialistModel = {
      findOne: jest.fn().mockReturnValue(specialistQuery),
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

  it('limits the customer list aggregation to bookings assigned to a specialist', async () => {
    const companyId = new Types.ObjectId();
    const specialistId = new Types.ObjectId();
    const aggregate = jest.fn().mockReturnValue({ exec: jest.fn() });
    const service = new BookingService(
      { aggregate } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await service.getBookingsCustomers({ companyId, specialistId });

    expect(aggregate.mock.calls[0][0][0]).toEqual({
      $match: {
        'company._id': expect.objectContaining({}),
        'specialist._id': expect.objectContaining({}),
      },
    });
  });

  it('keeps the customer list unscoped when no specialist scope is supplied', async () => {
    const companyId = new Types.ObjectId();
    const aggregate = jest.fn().mockReturnValue({ exec: jest.fn() });
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

    expect(aggregate.mock.calls[0][0][0]).toEqual({
      $match: { 'company._id': expect.objectContaining({}) },
    });
  });

  it('looks up customers by normalized email prefix within a company', async () => {
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

    await service.lookupCustomers({
      companyId,
      search: ' Ann.+@Example ',
      limit: 5,
    });

    expect(aggregate.mock.calls[0][0][0]).toEqual({
      $match: {
        'company._id': expect.objectContaining({}),
        'customer.email': { $regex: '^ann\\.\\+@example' },
      },
    });
    expect(aggregate.mock.calls[0][0]).toEqual(
      expect.arrayContaining([{ $limit: 5 }]),
    );
  });

  it('returns a minimal customer for an exact global email match', async () => {
    const customerId = new Types.ObjectId();
    const getUserBy = jest.fn().mockResolvedValue({
      _id: customerId,
      email: 'customer@example.com',
      firstName: 'Jane',
      lastName: 'Doe',
      avatar: null,
    });
    const service = new BookingService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { getUserBy } as any,
      {} as any,
    );

    await expect(
      service.lookupCustomerByEmail(' Customer@Example.com '),
    ).resolves.toEqual({
      id: customerId.toString(),
      email: 'customer@example.com',
      firstName: 'Jane',
      lastName: 'Doe',
      avatar: null,
    });
    expect(getUserBy).toHaveBeenCalledWith({ email: 'customer@example.com' });
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

  it('returns 404 for a customer without bookings assigned to the specialist', async () => {
    const companyId = new Types.ObjectId();
    const customerId = new Types.ObjectId();
    const specialistId = new Types.ObjectId();
    const aggregate = jest.fn().mockResolvedValue([]);
    const service = new BookingService(
      { aggregate } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.getCustomerDetails({
        companyId,
        customerId,
        assignedSpecialistId: specialistId,
      }),
    ).rejects.toThrow('Customer not found');

    expect(aggregate.mock.calls[0][0][0]).toEqual({
      $match: {
        'company._id': expect.objectContaining({}),
        'customer._id': expect.objectContaining({}),
        'specialist._id': expect.objectContaining({}),
      },
    });
  });

  it('limits customer booking history to the assigned specialist', async () => {
    const companyId = new Types.ObjectId();
    const customerId = new Types.ObjectId();
    const specialistId = new Types.ObjectId();
    const query: Record<string, jest.Mock> = {
      sort: jest.fn(),
      skip: jest.fn(),
      limit: jest.fn(),
    };
    query.sort.mockReturnValue(query);
    query.skip.mockReturnValue(query);
    query.limit.mockResolvedValue([{ id: 'assigned-booking' }]);
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

    await service.getCustomerBookings({
      companyId,
      customerId,
      assignedSpecialistId: specialistId,
    });

    expect(bookingModel.countDocuments).toHaveBeenCalledWith({
      'company._id': expect.objectContaining({}),
      'customer._id': expect.objectContaining({}),
      'specialist._id': expect.objectContaining({}),
    });
  });

  it.each([
    [BookingStatus.PENDING, BookingStatus.CONFIRMED],
    [BookingStatus.PENDING, BookingStatus.OFF],
    [BookingStatus.CONFIRMED, BookingStatus.COMPLETED],
    [BookingStatus.CONFIRMED, BookingStatus.OFF],
  ])(
    'allows a specialist to change %s booking to %s',
    async (currentStatus, nextStatus) => {
      const companyId = new Types.ObjectId();
      const bookingId = new Types.ObjectId();
      const specialistId = new Types.ObjectId();
      const booking = {
        status: currentStatus,
        save: jest.fn().mockResolvedValue('saved-booking'),
      };
      const bookingModel = { findOne: jest.fn().mockResolvedValue(booking) };
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
        service.updateAssignedBookingStatus({
          companyId: companyId.toString(),
          bookingId: bookingId.toString(),
          specialistId: specialistId.toString(),
          status: nextStatus,
        }),
      ).resolves.toBe('saved-booking');

      expect(bookingModel.findOne).toHaveBeenCalledWith({
        _id: expect.objectContaining({}),
        'company._id': expect.objectContaining({}),
        'specialist._id': expect.objectContaining({}),
      });
      const filters = bookingModel.findOne.mock.calls[0][0];
      expect(filters._id.toString()).toBe(bookingId.toString());
      expect(filters['company._id'].toString()).toBe(companyId.toString());
      expect(filters['specialist._id'].toString()).toBe(
        specialistId.toString(),
      );
      expect(booking.status).toBe(nextStatus);
      expect(booking.save).toHaveBeenCalledTimes(1);
    },
  );

  it('publishes a company-scoped event after updating a specialist booking status', async () => {
    const companyId = new Types.ObjectId();
    const bookingId = new Types.ObjectId();
    const specialistId = new Types.ObjectId();
    const savedBooking = {
      _id: bookingId,
      status: BookingStatus.CONFIRMED,
      updatedAt: new Date('2026-09-11T10:00:00.000Z'),
    };
    const booking = {
      status: BookingStatus.PENDING,
      save: jest.fn().mockResolvedValue(savedBooking),
    };
    // The unit exercises only the publisher interaction.
    const realtimeService = {
      publishBookingUpdated: jest.fn(),
    } as unknown as RealtimeService;
    // The unit exercises only findOne.
    const bookingModel = {
      findOne: jest.fn().mockResolvedValue(booking),
    } as unknown as Model<Booking>;
    const service = new BookingService(
      bookingModel,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      realtimeService,
    );

    await service.updateAssignedBookingStatus({
      companyId: companyId.toString(),
      bookingId: bookingId.toString(),
      specialistId: specialistId.toString(),
      status: BookingStatus.CONFIRMED,
    });

    expect(realtimeService.publishBookingUpdated).toHaveBeenCalledWith({
      companyId: companyId.toString(),
      bookingId: bookingId.toString(),
      changed: ['status'],
      status: BookingStatus.CONFIRMED,
      updatedAt: savedBooking.updatedAt,
    });
  });

  it('rejects a specialist status transition outside the allowed workflow', async () => {
    const booking = {
      status: BookingStatus.PENDING,
      save: jest.fn(),
    };
    const service = new BookingService(
      { findOne: jest.fn().mockResolvedValue(booking) } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.updateAssignedBookingStatus({
        companyId: new Types.ObjectId().toString(),
        bookingId: new Types.ObjectId().toString(),
        specialistId: new Types.ObjectId().toString(),
        status: BookingStatus.COMPLETED,
      }),
    ).rejects.toThrow('Status transition is not allowed for specialist');

    expect(booking.save).not.toHaveBeenCalled();
  });

  it('does not reveal or update a booking not assigned to the specialist', async () => {
    const bookingModel = { findOne: jest.fn().mockResolvedValue(null) };
    const service = new BookingService(
      bookingModel as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    const companyId = new Types.ObjectId();
    const bookingId = new Types.ObjectId();
    const specialistId = new Types.ObjectId();

    await expect(
      service.updateAssignedBookingStatus({
        companyId: companyId.toString(),
        bookingId: bookingId.toString(),
        specialistId: specialistId.toString(),
        status: BookingStatus.CONFIRMED,
      }),
    ).rejects.toThrow('Booking not found');

    expect(bookingModel.findOne).toHaveBeenCalledWith({
      _id: expect.objectContaining({}),
      'company._id': expect.objectContaining({}),
      'specialist._id': expect.objectContaining({}),
    });
  });
});
