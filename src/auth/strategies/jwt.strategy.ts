import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../types';
import { UserService } from '../../user/user.service';
import { UserAccountStatus } from '../../user/schema/user.schema';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly userService: UserService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('auth.secret'),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.userService.getUserBy({ id: payload.sub });

    if (
      !user ||
      user.accountStatus === UserAccountStatus.SUSPENDED ||
      user.tokenVersion !== payload.tokenVersion
    ) {
      throw new UnauthorizedException('Invalid token');
    }

    return user;
  }
}
