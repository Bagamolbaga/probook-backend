import { Types } from 'mongoose';
import { CompanyRole } from '../memberships/schema/company-membership.schema';
import { ShiftKind } from './schema/shift.schema';
import { ShiftController } from './shift.controller';

describe('ShiftController', () => {
  const companyId = new Types.ObjectId();
  const userId = new Types.ObjectId();
  const ownSpecialistId = new Types.ObjectId();
  const otherSpecialistId = new Types.ObjectId();

  it('returns only the current specialist schedule to a specialist', async () => {
    const shiftService = {
      getCompanyShifts: jest.fn().mockResolvedValue([
        {
          kind: ShiftKind.OVERRIDE,
          specialistId: ownSpecialistId.toString(),
          date: '2026-09-10',
        },
      ]),
    };
    const specialistService = {
      getSpecialistBy: jest.fn().mockResolvedValue({ id: ownSpecialistId }),
      getSpecialists: jest.fn().mockResolvedValue([
        { id: ownSpecialistId, defaultShift: null },
        { id: otherSpecialistId, defaultShift: null },
      ]),
    };
    const membershipService = {
      findActive: jest
        .fn()
        .mockResolvedValue([{ roles: [CompanyRole.SPECIALIST] }]),
    };
    const controller = new ShiftController(
      shiftService as never,
      specialistService as never,
      membershipService as never,
    );

    const result = await controller.getSpecialistsShifts(
      companyId,
      '2026-09-10',
      '2026-09-10',
      undefined,
      { _id: userId } as never,
    );

    expect(result.results).toHaveLength(1);
    expect(result.results[0].specialist.id).toEqual(ownSpecialistId);
    expect(membershipService.findActive).toHaveBeenCalledWith(
      userId,
      companyId,
    );
  });

  it('returns every specialist schedule to a company owner', async () => {
    const shiftService = { getCompanyShifts: jest.fn().mockResolvedValue([]) };
    const specialistService = {
      getSpecialistBy: jest.fn(),
      getSpecialists: jest.fn().mockResolvedValue([
        { id: ownSpecialistId, defaultShift: null },
        { id: otherSpecialistId, defaultShift: null },
      ]),
    };
    const membershipService = {
      findActive: jest.fn().mockResolvedValue([{ roles: [CompanyRole.OWNER] }]),
    };
    const controller = new ShiftController(
      shiftService as never,
      specialistService as never,
      membershipService as never,
    );

    const result = await controller.getSpecialistsShifts(
      companyId,
      undefined,
      undefined,
      undefined,
      { _id: userId } as never,
    );

    expect(result.results).toHaveLength(2);
    expect(specialistService.getSpecialistBy).not.toHaveBeenCalled();
  });
});
