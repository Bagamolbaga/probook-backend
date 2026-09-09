import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { AuthProvider, User, UserAccountStatus } from './schema/user.schema';
import { ClientSession, Model, Types } from 'mongoose';

type SafetyUser = Omit<User, 'id' | '_id'>;
export type CreateUserDto = Partial<SafetyUser>;
export type UpdateUserDto = Partial<SafetyUser>;

export type CreatePasswordUserDto = Pick<
  User,
  'email' | 'firstName' | 'lastName'
> &
  Partial<Pick<User, 'avatar' | 'emailVerified'>> & {
    passwordHash: string;
  };

export type CreateGoogleUserDto = Pick<
  User,
  'email' | 'firstName' | 'lastName'
> &
  Partial<Pick<User, 'avatar'>> & {
    googleId: string;
    emailVerified: boolean;
  };

export type FindOrCreateCustomerDto = Pick<
  User,
  'email' | 'firstName' | 'lastName'
>;

@Injectable()
export class UserService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  async createUser(dto: CreateUserDto) {
    const newUser = new this.userModel(dto);
    return newUser.save();
  }

  async getUsers() {
    return this.userModel.find();
  }

  async getUserBy({
    id,
    email,
    googleId,
  }: {
    id?: User['_id'] | string;
    email?: User['email'];
    googleId?: User['googleId'];
  }) {
    const filters = this.buildIdentityFilters({ id, email, googleId });

    if (!filters.length) {
      return null;
    }

    return this.userModel.findOne({ $or: filters });
  }

  async getUserForAuth(
    {
      id,
      email,
      googleId,
    }: {
      id?: User['_id'] | string;
      email?: User['email'];
      googleId?: User['googleId'];
    },
    session?: ClientSession,
  ) {
    const filters = this.buildIdentityFilters({ id, email, googleId });

    if (!filters.length) {
      return null;
    }

    const query = this.userModel
      .findOne({ $or: filters })
      .select('+passwordHash +refreshTokenHash');
    return session ? query.session(session) : query;
  }

  async createPasswordUser(
    dto: CreatePasswordUserDto,
    session?: ClientSession,
  ) {
    const newUser = new this.userModel({
      ...dto,
      authProvider: AuthProvider.PASSWORD,
      email: dto.email.toLowerCase(),
    });

    return session ? newUser.save({ session }) : newUser.save();
  }

  async createGoogleUser(dto: CreateGoogleUserDto) {
    const newUser = new this.userModel({
      ...dto,
      authProvider: AuthProvider.GOOGLE,
      email: dto.email.toLowerCase(),
    });

    return newUser.save();
  }

  async findOrCreateCustomer(dto: FindOrCreateCustomerDto) {
    const email = dto.email.trim().toLowerCase();

    return this.userModel.findOneAndUpdate(
      { email },
      {
        $setOnInsert: {
          email,
          firstName: dto.firstName,
          lastName: dto.lastName,
          accountStatus: UserAccountStatus.UNCLAIMED,
          authProvider: AuthProvider.PASSWORD,
          emailVerified: false,
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      },
    );
  }

  async linkGoogleProvider(userId: User['_id'] | string, googleId: string) {
    return this.userModel.findByIdAndUpdate(
      new Types.ObjectId(userId.toString()),
      {
        $set: {
          googleId,
          emailVerified: true,
          authProvider: AuthProvider.BOTH,
          accountStatus: UserAccountStatus.ACTIVE,
        },
      },
      { new: true },
    );
  }

  async claimWithPassword(
    userId: User['_id'] | string,
    passwordHash: string,
    profile: Pick<User, 'firstName' | 'lastName'>,
    session?: ClientSession,
  ) {
    return this.userModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(userId.toString()),
          accountStatus: UserAccountStatus.UNCLAIMED,
        },
        {
          $set: {
            passwordHash,
            firstName: profile.firstName,
            lastName: profile.lastName,
            authProvider: AuthProvider.PASSWORD,
            accountStatus: UserAccountStatus.ACTIVE,
          },
        },
        { new: true, runValidators: true, session },
      )
      .select('+passwordHash +refreshTokenHash');
  }

  async setRefreshTokenHash(userId: User['_id'] | string, hash: string | null) {
    return this.userModel.findByIdAndUpdate(
      new Types.ObjectId(userId.toString()),
      { $set: { refreshTokenHash: hash } },
      { new: true },
    );
  }

  async updateLastLogin(userId: User['_id'] | string) {
    return this.userModel.findByIdAndUpdate(
      new Types.ObjectId(userId.toString()),
      { $set: { lastLoginAt: new Date() } },
      { new: true },
    );
  }

  async updateUserBy(
    {
      id,
      email,
    }: {
      id?: User['_id'];
      email?: User['email'];
    },
    dto: UpdateUserDto,
  ) {
    const filters = this.buildIdentityFilters({ id, email });

    if (!filters.length) {
      return null;
    }

    return this.userModel.findOneAndUpdate(
      { $or: filters },
      { $set: dto },
      { new: true, runValidators: true },
    );
  }

  async deleteUserBy({
    id,
    email,
  }: {
    id?: User['_id'];
    email?: User['email'];
  }) {
    const filters = this.buildIdentityFilters({ id, email });

    if (!filters.length) {
      throw new NotFoundException('User not found');
    }

    const deletedUser = await this.userModel.findOneAndDelete({
      $or: filters,
    });

    if (!deletedUser) {
      throw new NotFoundException('User not found');
    }

    return deletedUser;
  }

  private buildIdentityFilters({
    id,
    email,
    googleId,
  }: {
    id?: User['_id'] | string;
    email?: User['email'];
    googleId?: User['googleId'];
  }) {
    const filters: Record<string, unknown>[] = [];

    if (id && Types.ObjectId.isValid(id.toString())) {
      filters.push({ _id: new Types.ObjectId(id.toString()) });
    }

    if (email) {
      filters.push({ email: email.toLowerCase() });
    }

    if (googleId) {
      filters.push({ googleId });
    }

    return filters;
  }
}
