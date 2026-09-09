import { InvitationAuthController } from './invitation.controller';

describe('InvitationAuthController', () => {
  it('issues tokens only after registration and activation are complete', async () => {
    const user = { _id: 'user-1', email: 'specialist@example.com' };
    const response = {
      accessToken: 'access-token',
      user: {
        ...user,
        companies: [{ id: 'company-1', name: 'Company' }],
        memberships: [{ companyId: 'company-1' }],
      },
    };
    const invitations = {
      registerPassword: jest.fn().mockResolvedValue(user),
    };
    const auth = {
      issueTokensForUser: jest.fn().mockResolvedValue(response),
    };
    const controller = new InvitationAuthController(
      invitations as any,
      auth as any,
    );

    await expect(
      controller.register('raw-token', { password: 'password123' }),
    ).resolves.toBe(response);

    expect(invitations.registerPassword).toHaveBeenCalledWith(
      'raw-token',
      'password123',
    );
    expect(auth.issueTokensForUser).toHaveBeenCalledWith(user);
    expect(
      invitations.registerPassword.mock.invocationCallOrder[0],
    ).toBeLessThan(auth.issueTokensForUser.mock.invocationCallOrder[0]);
  });
});
