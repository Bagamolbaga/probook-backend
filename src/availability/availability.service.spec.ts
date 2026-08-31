import { Types } from 'mongoose';
import { AvailabilityService } from './availability.service';

describe('AvailabilityService', () => {
  it('finds snapshot bookings and excludes the booking being edited', async () => {
    const companyId = new Types.ObjectId();
    const specialistId = new Types.ObjectId();
    const bookingId = new Types.ObjectId();
    const lean = jest.fn().mockResolvedValue([{ slots: [40, 41] }]);
    const select = jest.fn().mockReturnValue({ lean });
    const find = jest.fn().mockReturnValue({ select });
    const service = new AvailabilityService(
      {} as any,
      {} as any,
      {} as any,
      { find } as any,
      {} as any,
    );

    await expect(
      service.getBusySlots({
        companyId: companyId.toString(),
        specialistId: specialistId.toString(),
        date: '2026-09-01',
        excludeBookingId: bookingId.toString(),
      }),
    ).resolves.toEqual([40, 41]);

    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        date: '2026-09-01',
        _id: { $ne: expect.objectContaining({}) },
        $and: expect.arrayContaining([
          {
            $or: expect.arrayContaining([
              { 'company._id': expect.objectContaining({}) },
              { 'company.id': companyId.toString() },
            ]),
          },
          {
            $or: expect.arrayContaining([
              { 'specialist._id': expect.objectContaining({}) },
              { 'specialist.id': specialistId.toString() },
            ]),
          },
        ]),
      }),
    );
  });
});
