import { Types } from 'mongoose';
import { SpecialistService } from './specialist.service';

describe('SpecialistService', () => {
  it('exposes the specialist profile id separately from the user id', async () => {
    const companyId = new Types.ObjectId();
    const specialistId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const query = {
      populate: jest.fn(),
      lean: jest.fn(),
    };
    query.populate.mockReturnValue(query);
    query.lean.mockResolvedValue([
      {
        _id: specialistId,
        company: companyId,
        userId: {
          _id: userId,
          firstName: 'Anna',
          lastName: 'Smith',
        },
        active: true,
        services: [],
        specialties: [],
      },
    ]);
    const specialistModel = {
      find: jest.fn().mockReturnValue(query),
    };
    const service = new SpecialistService(
      specialistModel as never,
      {} as never,
    );

    const [specialist] = await service.getSpecialists({ companyId });

    expect(specialist.id).toBe(specialistId.toString());
    expect(specialist.userId).toEqual(userId);
    expect(specialist.fullName).toBe('Anna Smith');
  });
});
