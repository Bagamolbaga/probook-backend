import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthProvider, UserRole } from '../user/schema/user.schema';

jest.mock('argon2', () => ({
  hash: jest.fn(async (value: string) => `hashed:${value}`),
  verify: jest.fn(async (_hash: string, value: string) => value !== 'bad'),
}));

const createUser = (overrides: Record<string, unknown> = {}) =>
  ({
    _id: { toString: () => 'user-1' },
    email: 'owner@example.com',
    firstName: 'Owner',
    lastName: 'User',
    company: null,
    role: UserRole.OWNER,
    authProvider: AuthProvider.PASSWORD,
    passwordHash: 'hashed:password',
    refreshTokenHash: 'hashed:refresh',
    tokenVersion: 0,
    ...overrides,
  }) as any;

const createService = () => {
  const userService = {
    getUserBy: jest.fn(),
    getUserForAuth: jest.fn(),
    createPasswordUser: jest.fn(),
    createGoogleUser: jest.fn(),
    linkGoogleProvider: jest.fn(),
    updateUserBy: jest.fn(),
    setRefreshTokenHash: jest.fn(),
    updateLastLogin: jest.fn(),
    setCompany: jest.fn(),
  };
  const companyService = {
    createCompany: jest.fn(),
  };
  const jwtService = {
    signAsync: jest.fn(async () => 'access-token'),
  };
  const configService = {
    get: jest.fn((key: string) => {
      const values = {
        'auth.accessTokenTtl': 36000,
        'auth.refreshTokenTtl': 2592000,
        'auth.googleClientId': 'google-client-id',
      };

      return values[key];
    }),
  };
  const service = new AuthService(
    userService as any,
    companyService as any,
    jwtService as any,
    configService as any,
  );

  return { service, userService, companyService, jwtService, configService };
};

describe('AuthService', () => {
  it('registers an owner, creates company, and issues tokens', async () => {
    const { service, userService, companyService, jwtService } =
      createService();
    const user = createUser({
      toObject: () => createUser(),
    });
    const company = { _id: { toString: () => 'company-1' } };
    const updatedUser = createUser({ company: company._id });
    userService.getUserBy.mockResolvedValue(null);
    userService.createPasswordUser.mockResolvedValue(user);
    companyService.createCompany.mockResolvedValue(company);
    userService.setCompany.mockResolvedValue(updatedUser);

    const result = await service.register({
      email: 'OWNER@EXAMPLE.COM',
      password: 'password123',
      firstName: 'Owner',
      lastName: 'User',
      company: {
        name: 'ProBook Studio',
        phone: '+10000000000',
      },
    });

    expect(userService.createPasswordUser).toHaveBeenCalledWith({
      email: 'owner@example.com',
      passwordHash: expect.stringMatching(/^hashed:/),
      firstName: 'Owner',
      lastName: 'User',
      role: UserRole.OWNER,
      emailVerified: false,
    });
    expect(companyService.createCompany).toHaveBeenCalledWith({
      name: 'ProBook Studio',
      phone: '+10000000000',
      owner: user._id,
    });
    expect(userService.setCompany).toHaveBeenCalledWith(user._id, company._id);
    expect(result.user).toBe(updatedUser);
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: 'user-1',
        companyId: 'company-1',
      }),
      { expiresIn: 36000 },
    );
  });

  it('rejects duplicate registration emails', async () => {
    const { service, userService, companyService } = createService();
    userService.getUserBy.mockResolvedValue(createUser());

    await expect(
      service.register({
        email: 'owner@example.com',
        password: 'password123',
        firstName: 'Owner',
        lastName: 'User',
        company: {
          name: 'ProBook Studio',
        },
      }),
    ).rejects.toThrow(ConflictException);
    expect(companyService.createCompany).not.toHaveBeenCalled();
  });

  it('logs in a password user and rotates refresh token', async () => {
    const { service, userService, jwtService } = createService();
    const user = createUser();
    userService.getUserForAuth.mockResolvedValue(user);

    const result = await service.login('owner@example.com', 'password');

    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toEqual(expect.any(String));
    expect(result.expiresIn).toBe(36000);
    expect(result.tokenType).toBe('Bearer');
    expect(result.user).toBe(user);
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      {
        sub: 'user-1',
        email: 'owner@example.com',
        role: UserRole.OWNER,
        companyId: null,
        tokenVersion: 0,
      },
      { expiresIn: 36000 },
    );
    expect(userService.setRefreshTokenHash).toHaveBeenCalledWith(
      user._id,
      expect.stringMatching(/^hashed:/),
    );
    expect(userService.updateLastLogin).toHaveBeenCalledWith(user._id);
  });

  it('rejects invalid password credentials', async () => {
    const { service, userService } = createService();
    userService.getUserForAuth.mockResolvedValue(createUser());

    await expect(service.login('owner@example.com', 'bad')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects users without password auth', async () => {
    const { service, userService } = createService();
    userService.getUserForAuth.mockResolvedValue(
      createUser({
        authProvider: AuthProvider.GOOGLE,
        passwordHash: undefined,
      }),
    );

    await expect(
      service.login('owner@example.com', 'password'),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('creates a user from a verified Google id token', async () => {
    const { service, userService } = createService();
    const googleUser = createUser({
      authProvider: AuthProvider.GOOGLE,
      googleId: 'google-sub',
      avatar: 'https://example.com/avatar.png',
      passwordHash: undefined,
    });
    (service as any).googleClient = {
      verifyIdToken: jest.fn(async () => ({
        getPayload: () => ({
          sub: 'google-sub',
          email: 'owner@example.com',
          email_verified: true,
          given_name: 'Owner',
          family_name: 'User',
          picture: 'https://example.com/avatar.png',
        }),
      })),
    };
    userService.getUserForAuth
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    userService.createGoogleUser.mockResolvedValue(googleUser);

    const result = await service.loginWithGoogle('id-token');

    expect(result.created).toBe(true);
    expect(userService.createGoogleUser).toHaveBeenCalledWith({
      email: 'owner@example.com',
      googleId: 'google-sub',
      emailVerified: true,
      firstName: 'Owner',
      lastName: 'User',
      avatar: 'https://example.com/avatar.png',
    });
    expect(userService.updateUserBy).not.toHaveBeenCalled();
  });

  it('updates a changed Google avatar and returns it in the auth response', async () => {
    const { service, userService } = createService();
    const existingUser = createUser({
      authProvider: AuthProvider.GOOGLE,
      googleId: 'google-sub',
      avatar: 'https://example.com/old-avatar.png',
    });
    const updatedUser = createUser({
      authProvider: AuthProvider.GOOGLE,
      googleId: 'google-sub',
      avatar: 'https://example.com/new-avatar.png',
    });
    (service as any).googleClient = {
      verifyIdToken: jest.fn(async () => ({
        getPayload: () => ({
          sub: 'google-sub',
          email: 'owner@example.com',
          email_verified: true,
          picture: 'https://example.com/new-avatar.png',
        }),
      })),
    };
    userService.getUserForAuth.mockResolvedValue(existingUser);
    userService.updateUserBy.mockResolvedValue(updatedUser);

    const result = await service.loginWithGoogle('id-token');

    expect(userService.updateUserBy).toHaveBeenCalledWith(
      { id: existingUser._id },
      { avatar: 'https://example.com/new-avatar.png' },
    );
    expect(result.user).toBe(updatedUser);
  });

  it('links Google auth to an existing email user', async () => {
    const { service, userService } = createService();
    const existingUser = createUser();
    const linkedUser = createUser({
      authProvider: AuthProvider.BOTH,
      googleId: 'google-sub',
    });
    (service as any).googleClient = {
      verifyIdToken: jest.fn(async () => ({
        getPayload: () => ({
          sub: 'google-sub',
          email: 'owner@example.com',
          email_verified: true,
        }),
      })),
    };
    userService.getUserForAuth
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existingUser);
    userService.linkGoogleProvider.mockResolvedValue(linkedUser);

    const result = await service.loginWithGoogle('id-token');

    expect(result.created).toBe(false);
    expect(userService.linkGoogleProvider).toHaveBeenCalledWith(
      existingUser._id,
      'google-sub',
    );
  });

  it('rejects unverified Google emails', async () => {
    const { service } = createService();
    (service as any).googleClient = {
      verifyIdToken: jest.fn(async () => ({
        getPayload: () => ({
          sub: 'google-sub',
          email: 'owner@example.com',
          email_verified: false,
        }),
      })),
    };

    await expect(service.loginWithGoogle('id-token')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects invalid Google tokens', async () => {
    const { service } = createService();
    (service as any).googleClient = {
      verifyIdToken: jest.fn(async () => {
        throw new Error('Invalid token signature');
      }),
    };

    await expect(service.loginWithGoogle('invalid-token')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects Google account conflicts', async () => {
    const { service, userService } = createService();
    (service as any).googleClient = {
      verifyIdToken: jest.fn(async () => ({
        getPayload: () => ({
          sub: 'google-sub',
          email: 'owner@example.com',
          email_verified: true,
        }),
      })),
    };
    userService.getUserForAuth
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(createUser({ googleId: 'other-google-sub' }));

    await expect(service.loginWithGoogle('id-token')).rejects.toThrow(
      ConflictException,
    );
  });

  it('rotates refresh tokens and rejects reused tokens', async () => {
    const { service, userService } = createService();
    const user = createUser();
    userService.getUserForAuth.mockResolvedValue(user);
    const loginResult = await service.login('owner@example.com', 'password');

    const refreshResult = await service.refresh(loginResult.refreshToken);

    expect(refreshResult.accessToken).toBe('access-token');
    expect(userService.setRefreshTokenHash).toHaveBeenCalledTimes(2);

    await expect(service.refresh('bad')).rejects.toThrow(UnauthorizedException);
  });

  it('invalidates refresh token on logout', async () => {
    const { service, userService } = createService();
    const user = createUser();
    userService.getUserForAuth.mockResolvedValue(user);
    const loginResult = await service.login('owner@example.com', 'password');

    await service.logout(loginResult.refreshToken);

    expect(userService.setRefreshTokenHash).toHaveBeenLastCalledWith(
      'user-1',
      null,
    );
  });
});
