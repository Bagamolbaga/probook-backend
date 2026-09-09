import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client, TokenPayload } from 'google-auth-library';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { UserService } from '../user/user.service';
import {
  AuthProvider,
  User,
  UserAccountStatus,
} from '../user/schema/user.schema';
import {
  CompanyService,
  CreateCompanyDto,
} from '../companies/companies.service';
import { AuthCompany, AuthMembership, AuthUser, JwtPayload } from './types';
import { RegisterDto } from './dto/register.dto';
import { MembershipService } from '../memberships/membership.service';
import { CompanyRole } from '../memberships/schema/company-membership.schema';
import { SpecialistService } from '../specialists/specialist.service';

type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
  user: AuthUser;
};

type GoogleAuthResult = AuthResponse & {
  created: boolean;
};

@Injectable()
export class AuthService {
  private readonly googleClient = new OAuth2Client();

  constructor(
    private readonly userService: UserService,
    private readonly companyService: CompanyService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly memberships: MembershipService,
    private readonly specialists: SpecialistService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const email = dto.email.toLowerCase();
    const existingUser = await this.userService.getUserBy({ email });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.userService.createPasswordUser({
      email,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      emailVerified: false,
    });
    const companyDto: CreateCompanyDto = {
      ...dto.company,
      owner: user._id,
    } as CreateCompanyDto;
    const company = await this.companyService.createCompany(companyDto);
    await this.memberships.upsertRole(user._id, company._id, CompanyRole.OWNER);

    await this.userService.updateLastLogin(user._id);

    return this.issueTokens(user);
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const user = await this.userService.getUserForAuth({ email });

    if (
      !user?.passwordHash ||
      user.accountStatus !== UserAccountStatus.ACTIVE ||
      user.authProvider === AuthProvider.GOOGLE ||
      !(await argon2.verify(user.passwordHash, password))
    ) {
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.userService.updateLastLogin(user._id);

    return this.issueTokens(user);
  }

  async loginWithGoogle(idToken: string): Promise<GoogleAuthResult> {
    const googleClientId = this.configService.get<string>(
      'auth.googleClientId',
    );

    if (!googleClientId) {
      throw new UnauthorizedException('Google auth is not configured');
    }

    let payload: TokenPayload | undefined;

    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: googleClientId,
      });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Invalid Google token');
    }

    if (!payload?.sub || !payload.email || !payload.email_verified) {
      throw new UnauthorizedException('Invalid Google token');
    }

    const email = payload.email.toLowerCase();
    let user = await this.userService.getUserForAuth({ googleId: payload.sub });
    let created = false;

    if (user?.accountStatus === UserAccountStatus.SUSPENDED) {
      throw new UnauthorizedException('Account is suspended');
    }

    if (!user) {
      const existingUser = await this.userService.getUserForAuth({ email });

      if (existingUser?.accountStatus === UserAccountStatus.SUSPENDED) {
        throw new UnauthorizedException('Account is suspended');
      }

      if (existingUser?.googleId && existingUser.googleId !== payload.sub) {
        throw new ConflictException('Google account conflict');
      }

      if (existingUser) {
        user = await this.userService.linkGoogleProvider(
          existingUser._id,
          payload.sub,
        );
      } else {
        user = await this.userService.createGoogleUser({
          email,
          googleId: payload.sub,
          emailVerified: true,
          firstName: payload.given_name || payload.name || email,
          lastName: payload.family_name || '',
          avatar: payload.picture || null,
        });
        created = true;
      }
    }

    await this.userService.updateLastLogin(user._id);

    if (payload.picture && user.avatar !== payload.picture) {
      const updatedUser = await this.userService.updateUserBy(
        { id: user._id },
        { avatar: payload.picture },
      );

      if (updatedUser) {
        user = updatedUser;
      }
    }

    return {
      ...(await this.issueTokens(user)),
      created,
    };
  }

  async refresh(refreshToken: string): Promise<AuthResponse> {
    const payload = this.decodeRefreshToken(refreshToken);
    const user = await this.userService.getUserForAuth({ id: payload.userId });

    if (
      !user?.refreshTokenHash ||
      user.accountStatus !== UserAccountStatus.ACTIVE ||
      !(await argon2.verify(user.refreshTokenHash, refreshToken))
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.issueTokens(user);
  }

  async logout(refreshToken: string): Promise<void> {
    const payload = this.decodeRefreshToken(refreshToken);
    const user = await this.userService.getUserForAuth({ id: payload.userId });

    if (
      !user?.refreshTokenHash ||
      !(await argon2.verify(user.refreshTokenHash, refreshToken))
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.userService.setRefreshTokenHash(payload.userId, null);
  }

  async me(user: User) {
    return { user: await this.enrichUser(user) };
  }

  issueTokensForUser(user: User) {
    return this.issueTokens(user);
  }

  private async issueTokens(user: User): Promise<AuthResponse> {
    const expiresIn = this.configService.get<number>('auth.accessTokenTtl');
    const payload = this.buildAccessPayload(user);
    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn,
    });
    const refreshToken = this.createRefreshToken(user);
    const refreshTokenHash = await argon2.hash(refreshToken);

    await this.userService.setRefreshTokenHash(user._id, refreshTokenHash);

    return {
      accessToken,
      refreshToken,
      expiresIn,
      tokenType: 'Bearer',
      user: await this.enrichUser(user),
    };
  }

  private buildAccessPayload(user: User): JwtPayload {
    return {
      sub: user._id.toString(),
      email: user.email,
      tokenVersion: user.tokenVersion || 0,
    };
  }

  private async enrichUser(user: User): Promise<AuthUser> {
    const membershipDocuments = await this.memberships.findActive(user._id);
    const memberships: AuthMembership[] = await Promise.all(
      membershipDocuments.map(async (membership: any) => {
        const companyId =
          membership.companyId?._id?.toString?.() ||
          membership.companyId.toString();
        const profile = membership.roles.includes(CompanyRole.SPECIALIST)
          ? await this.specialists.getSpecialistBy({
              userId: user._id,
              companyId,
            })
          : null;
        return {
          id: membership._id.toString(),
          companyId,
          companyName: membership.companyId?.name || null,
          roles: membership.roles,
          status: membership.status,
          specialistProfileId: profile?._id.toString() || null,
          permissions: this.memberships.permissions(membership.roles),
        };
      }),
    );
    const companies: AuthCompany[] = memberships.map((membership) => ({
      id: membership.companyId,
      name: membership.companyName,
      roles: membership.roles,
      specialistProfileId: membership.specialistProfileId,
      permissions: membership.permissions,
    }));
    const safe =
      typeof (user as any).toObject === 'function'
        ? (user as any).toObject()
        : { ...user };
    delete safe.passwordHash;
    delete safe.refreshTokenHash;
    delete safe.tokenVersion;
    return { ...safe, companies, memberships } as AuthUser;
  }

  private createRefreshToken(user: User) {
    const payload = {
      userId: user._id.toString(),
      tokenId: randomBytes(24).toString('hex'),
      expiresAt:
        Date.now() +
        this.configService.get<number>('auth.refreshTokenTtl') * 1000,
    };

    return Buffer.from(JSON.stringify(payload)).toString('base64url');
  }

  private decodeRefreshToken(refreshToken: string) {
    try {
      const payload = JSON.parse(
        Buffer.from(refreshToken, 'base64url').toString('utf8'),
      ) as {
        userId?: string;
        expiresAt?: number;
      };

      if (
        !payload.userId ||
        !payload.expiresAt ||
        payload.expiresAt < Date.now()
      ) {
        throw new Error('Invalid refresh token');
      }

      return {
        userId: payload.userId,
      };
    } catch (_error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
