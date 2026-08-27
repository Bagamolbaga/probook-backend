import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { AuthProvider, User } from './schema/user.schema';
import { Model, Types } from 'mongoose';

type SafetyUser = Omit<User, 'id' | '_id'>;
export type CreateUserDto = Partial<SafetyUser>;
export type UpdateUserDto = Partial<SafetyUser>;

export type CreatePasswordUserDto = Pick<
  User,
  'email' | 'firstName' | 'lastName'
> &
  Partial<Pick<User, 'avatar' | 'company' | 'role' | 'emailVerified'>> & {
    passwordHash: string;
  };

export type CreateGoogleUserDto = Pick<
  User,
  'email' | 'firstName' | 'lastName'
> &
  Partial<Pick<User, 'avatar' | 'company' | 'role'>> & {
    googleId: string;
    emailVerified: boolean;
  };

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

  async getUserForAuth({
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

    return this.userModel
      .findOne({ $or: filters })
      .select('+passwordHash +refreshTokenHash');
  }

  async createPasswordUser(dto: CreatePasswordUserDto) {
    const newUser = new this.userModel({
      ...dto,
      authProvider: AuthProvider.PASSWORD,
      email: dto.email.toLowerCase(),
    });

    return newUser.save();
  }

  async createGoogleUser(dto: CreateGoogleUserDto) {
    const newUser = new this.userModel({
      ...dto,
      authProvider: AuthProvider.GOOGLE,
      email: dto.email.toLowerCase(),
    });

    return newUser.save();
  }

  async linkGoogleProvider(userId: User['_id'] | string, googleId: string) {
    return this.userModel.findByIdAndUpdate(
      userId,
      {
        $set: {
          googleId,
          emailVerified: true,
          authProvider: AuthProvider.BOTH,
        },
      },
      { new: true },
    );
  }

  async setRefreshTokenHash(userId: User['_id'] | string, hash: string | null) {
    return this.userModel.findByIdAndUpdate(
      userId,
      { $set: { refreshTokenHash: hash } },
      { new: true },
    );
  }

  async updateLastLogin(userId: User['_id'] | string) {
    return this.userModel.findByIdAndUpdate(
      userId,
      { $set: { lastLoginAt: new Date() } },
      { new: true },
    );
  }

  async setCompany(userId: User['_id'] | string, companyId: User['company']) {
    return this.userModel.findByIdAndUpdate(
      userId,
      { $set: { company: companyId } },
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

    return this.userModel.updateOne({ $or: filters }, dto);
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
      filters.push({ _id: id });
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
