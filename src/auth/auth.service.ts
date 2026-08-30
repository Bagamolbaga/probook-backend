import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { UserService } from '../user/user.service';
import { AuthProvider, User, UserRole } from '../user/schema/user.schema';
import {
  CompanyService,
  CreateCompanyDto,
} from '../companies/companies.service';
import { JwtPayload } from './types';
import { RegisterDto } from './dto/register.dto';

type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
  user: User;
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
      role: UserRole.OWNER,
      emailVerified: false,
    });
    const companyDto: CreateCompanyDto = {
      ...dto.company,
      owner: user._id,
    } as CreateCompanyDto;
    const company = await this.companyService.createCompany(companyDto);
    const updatedUser = await this.userService.setCompany(
      user._id,
      company._id,
    );
    const authUser = updatedUser || {
      ...user.toObject(),
      company: company._id,
    };

    await this.userService.updateLastLogin(user._id);

    return this.issueTokens(authUser as User);
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const user = await this.userService.getUserForAuth({ email });

    if (
      !user?.passwordHash ||
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

    const ticket = await this.googleClient.verifyIdToken({
      idToken,
      audience: googleClientId,
    });
    const payload = ticket.getPayload();

    if (!payload?.sub || !payload.email || !payload.email_verified) {
      throw new UnauthorizedException('Invalid Google token');
    }

    const email = payload.email.toLowerCase();
    let user = await this.userService.getUserForAuth({ googleId: payload.sub });
    let created = false;

    if (!user) {
      const existingUser = await this.userService.getUserForAuth({ email });

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
    return { user };
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
      user,
    };
  }

  private buildAccessPayload(user: User): JwtPayload {
    return {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
      companyId: user.company?.toString() || null,
      tokenVersion: user.tokenVersion || 0,
    };
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
