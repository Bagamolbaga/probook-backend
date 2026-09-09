import { Types } from 'mongoose';
import { CompanyRole } from '../memberships/schema/company-membership.schema';
import { SpecialistController } from './specialist.controller';

describe('SpecialistController', () => {
  const companyId = new Types.ObjectId();
  const userId = new Types.ObjectId();

  it('includes staff email addresses for an active company owner', async () => {
    const specialistService = {
      getSpecialists: jest.fn().mockResolvedValue([]),
    };
    const membershipService = {
      findActive: jest.fn().mockResolvedValue([
        { roles: [CompanyRole.OWNER] },
      ]),
    };
    const controller = new SpecialistController(
      specialistService as never,
      membershipService as never,
    );

    await controller.getSpecialistBy(companyId, { _id: userId } as never);

    expect(membershipService.findActive).toHaveBeenCalledWith(userId, companyId);
    expect(specialistService.getSpecialists).toHaveBeenCalledWith({
      companyId,
      includeEmail: true,
    });
  });

  it('does not expose staff email addresses without an owner membership', async () => {
    const specialistService = {
      getSpecialists: jest.fn().mockResolvedValue([]),
    };
    const membershipService = { findActive: jest.fn() };
    const controller = new SpecialistController(
      specialistService as never,
      membershipService as never,
    );

    await controller.getSpecialistBy(companyId);

    expect(membershipService.findActive).not.toHaveBeenCalled();
    expect(specialistService.getSpecialists).toHaveBeenCalledWith({
      companyId,
      includeEmail: false,
    });
  });
});
