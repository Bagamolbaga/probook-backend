import { ConflictException } from '@nestjs/common';
import { Types } from 'mongoose';
import { CompanyRole } from '../memberships/schema/company-membership.schema';
import { UserAccountStatus } from '../user/schema/user.schema';
import { InvitationService } from './invitation.service';
import { InvitationStatus } from './schema/company-invitation.schema';

jest.mock('argon2', () => ({
  hash: jest.fn(async (value: string) => `hashed:${value}`),
}));

describe('InvitationService registerPassword', () => {
  const createService = () => {
    const session = {
      withTransaction: jest.fn(async (callback: () => Promise<void>) =>
        callback(),
      ),
      endSession: jest.fn(),
    };
    const invitation = {
      _id: new Types.ObjectId(),
      companyId: new Types.ObjectId(),
      email: 'specialist@example.com',
      firstName: 'Spec',
      lastName: 'Ialist',
      roles: [CompanyRole.SPECIALIST],
      specialistProfile: {
        firstName: 'Spec',
        lastName: 'Ialist',
        bio: 'Bio',
        specialties: ['Hair'],
      },
      status: InvitationStatus.PENDING,
      expiresAt: new Date(Date.now() + 60_000),
    } as any;
    const invitations = {
      findOne: jest.fn(() => ({
        select: jest.fn().mockResolvedValue(invitation),
      })),
      findOneAndUpdate: jest.fn().mockResolvedValue({
        ...invitation,
        status: InvitationStatus.ACCEPTED,
      }),
    };
    const companies = {};
    const user = {
      _id: new Types.ObjectId(),
      email: invitation.email,
      accountStatus: UserAccountStatus.ACTIVE,
    };
    const users = {
      getUserForAuth: jest.fn().mockResolvedValue(null),
      createPasswordUser: jest.fn().mockResolvedValue(user),
      claimWithPassword: jest.fn(),
    };
    const memberships = {
      upsertRole: jest.fn().mockResolvedValue({}),
    };
    const profile = { _id: new Types.ObjectId() };
    const specialists = {
      createSpecialist: jest.fn().mockResolvedValue(profile),
    };
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'auth.secret') return 'test-auth-secret';
        if (key === 'frontendUrl') return 'https://app.example.test';
        return undefined;
      }),
    };
    const service = new InvitationService(
      invitations as any,
      companies as any,
      users as any,
      memberships as any,
      specialists as any,
      {} as any,
      config as any,
      { startSession: jest.fn().mockResolvedValue(session) } as any,
    );

    return {
      service,
      session,
      invitation,
      invitations,
      user,
      users,
      memberships,
      specialists,
      config,
      profile,
    };
  };

  it('creates the account, claims the invitation, and activates the specialist in one transaction', async () => {
    const {
      service,
      session,
      invitation,
      invitations,
      user,
      users,
      memberships,
      specialists,
    } = createService();

    await expect(
      service.registerPassword('raw-token', 'password123'),
    ).resolves.toBe(user);

    expect(users.getUserForAuth).toHaveBeenCalledWith(
      { email: invitation.email },
      session,
    );
    expect(users.createPasswordUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: invitation.email,
        passwordHash: 'hashed:password123',
      }),
      session,
    );
    expect(invitations.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: invitation._id,
        status: InvitationStatus.PENDING,
      }),
      expect.objectContaining({
        $set: expect.objectContaining({
          status: InvitationStatus.ACCEPTED,
          acceptedByUserId: new Types.ObjectId(user._id.toString()),
        }),
      }),
      { new: true, session },
    );
    expect(memberships.upsertRole).toHaveBeenCalledWith(
      user._id.toString(),
      invitation.companyId,
      CompanyRole.SPECIALIST,
      session,
    );
    expect(specialists.createSpecialist).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: user._id.toString(),
        company: invitation.companyId,
      }),
      session,
    );
    expect(
      invitations.findOneAndUpdate.mock.invocationCallOrder[0],
    ).toBeLessThan(memberships.upsertRole.mock.invocationCallOrder[0]);
    expect(session.endSession).toHaveBeenCalled();
  });

  it('rejects a concurrently accepted invitation before membership or profile writes', async () => {
    const { service, session, invitations, memberships, specialists } =
      createService();
    invitations.findOneAndUpdate.mockResolvedValue(null);

    await expect(
      service.registerPassword('raw-token', 'password123'),
    ).rejects.toThrow(ConflictException);

    expect(memberships.upsertRole).not.toHaveBeenCalled();
    expect(specialists.createSpecialist).not.toHaveBeenCalled();
    expect(session.endSession).toHaveBeenCalled();
  });

  it('encrypts an invitation token before it is stored for link copying', () => {
    const { service } = createService();
    const token = 'raw-invitation-token';
    const ciphertext = (service as any).encryptToken(token);

    expect(ciphertext).not.toContain(token);
    expect((service as any).decryptToken(ciphertext)).toBe(token);
  });
});
