import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { UserModule } from '../user/user.module';
import { CompanyModule } from '../companies/companies.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CompanyOwnerGuard } from './guards/company-owner.guard';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    UserModule,
    CompanyModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('auth.secret'),
      }),
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 60,
      },
    ]),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, CompanyOwnerGuard],
  exports: [CompanyOwnerGuard],
})
export class AuthModule {}
