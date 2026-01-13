import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Post,
  Request,
} from '@nestjs/common';
import { CreateUserDto, UserService } from './user.service';

@Controller('users')
export class UserController {
  constructor(private userService: UserService) {}

  @Get()
  async getUserBy(@Request() req) {
    const { id, email } = req.query;
    if (id || email) {
      const user = await this.userService.getUserBy({ id, email });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      return user;
    }
  }

  @Post()
  async createUser(@Request() req, @Body() body: CreateUserDto) {
    try {
      const newUser = await this.userService.createUser(body);

      return newUser;
    } catch (error) {
      console.log(error);
    }
  }
}
