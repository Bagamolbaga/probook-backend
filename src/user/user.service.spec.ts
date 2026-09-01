import { NotFoundException } from '@nestjs/common';
import { UserService } from './user.service';

describe('UserService', () => {
  const createService = () => {
    const model = {
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      updateOne: jest.fn(),
      findOneAndDelete: jest.fn(),
    };
    const service = new UserService(model as any);

    return { service, model };
  };

  it('returns null instead of querying with undefined filters', async () => {
    const { service, model } = createService();

    await expect(service.getUserBy({})).resolves.toBeNull();

    expect(model.findOne).not.toHaveBeenCalled();
  });

  it('builds only provided identity filters', async () => {
    const { service, model } = createService();
    model.findOne.mockReturnValue('query');

    const result = await service.getUserBy({ email: 'OWNER@EXAMPLE.COM' });

    expect(result).toBe('query');
    expect(model.findOne).toHaveBeenCalledWith({
      $or: [{ email: 'owner@example.com' }],
    });
  });

  it('returns null on update with no identity filters', async () => {
    const { service, model } = createService();

    await expect(
      service.updateUserBy({}, { firstName: 'Owner' }),
    ).resolves.toBeNull();

    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('atomically finds or creates a normalized customer account', async () => {
    const { service, model } = createService();
    const customer = { _id: 'customer-id', email: 'customer@example.com' };
    model.findOneAndUpdate.mockResolvedValue(customer);

    await expect(
      service.findOrCreateCustomer({
        email: ' Customer@Example.com ',
        firstName: 'Jane',
        lastName: 'Doe',
      }),
    ).resolves.toBe(customer);

    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { email: 'customer@example.com' },
      {
        $setOnInsert: {
          email: 'customer@example.com',
          firstName: 'Jane',
          lastName: 'Doe',
          role: 'customer',
          emailVerified: false,
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      },
    );
  });

  it('throws NotFoundException on delete with no identity filters', async () => {
    const { service, model } = createService();

    await expect(service.deleteUserBy({})).rejects.toThrow(NotFoundException);

    expect(model.findOneAndDelete).not.toHaveBeenCalled();
  });
});
