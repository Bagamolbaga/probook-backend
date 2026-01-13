import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User } from './schema/user.schema';
import { Model } from 'mongoose';

type SafetyUser = Omit<User, 'id' | '_id'>;
export type CreateUserDto = Partial<SafetyUser>;
export type UpdateUserDto = Partial<SafetyUser>;

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

  async getUserBy({ id, email }: { id?: User['_id']; email?: User['email'] }) {
    return this.userModel.findOne({ $or: [{ _id: id }, { email }] });
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
    return this.userModel.updateOne({ _id: id, email }, dto);
  }

  async deleteUserBy({
    id,
    email,
  }: {
    id?: User['_id'];
    email?: User['email'];
  }) {
    const deletedUser = await this.userModel.findOneAndDelete({
      _id: id,
      email,
    });

    if (!deletedUser) {
      throw new NotFoundException('User not found');
    }

    return deletedUser;
  }
}
