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
    const savedBooking = { id: 'booking-id' };
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
    const service = new BookingService(
      bookingModel as any,
      serviceModel as any,
      specialistModel as any,
      companyModel as any,
      availabilityService as any,
      userService as any,
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
  });

  it('reads bookings by the embedded company id without populate', async () => {
    const companyId = new Types.ObjectId();
    const bookingModel = {
      find: jest.fn().mockResolvedValue([{ id: 'booking-id' }]),
    };
    const service = new BookingService(
      bookingModel as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await service.getBookings({ companyId });

    expect(bookingModel.find).toHaveBeenCalledWith({
      'company._id': expect.objectContaining({}),
    });
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
