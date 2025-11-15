import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import Redis from 'ioredis';
import { Model } from 'mongoose';
import { UserDocument } from './schemas/user.schema';

const MOCK_USERS = {
  1: { id: 1, name: 'Alice Johnson', email: 'alice@example.com' },
  2: { id: 2, name: 'Bob Smith', email: 'bob@example.com' },
  3: { id: 3, name: 'Charlie Brown', email: 'charlie@example.com' },
};

@Injectable()
export class AppService {
  private redis: Redis;

  constructor(
    @InjectModel('User') private userModel: Model<UserDocument>,
    private configService: ConfigService,
  ) {
    this.redis = new Redis({
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: this.configService.get('REDIS_PORT', 6379),
    });
  }

  async createUser(createUserDto: any): Promise<UserDocument> {
    const createdUser = new this.userModel(createUserDto);
    //Cache the user data after creation
    await this.redis.setex(
      `user:${createdUser._id}`,
      600,
      JSON.stringify(createdUser),
    );
    return createdUser.save();
  }
  async getUserById(id: number) {
    const cacheKey = `user:${id}`;
    //check redis cache
    const cachedUser = await this.redis.get(cacheKey);
    if (cachedUser) {
      console.log(`Cache HIT for user ${id}`);
      return JSON.parse(cachedUser);
    }
    console.log(`Cache Miss for user ${id}`);
    //Query database
    const user = await this.userModel.findById(id).lean();
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    //Store in redis
    await this.redis.setex(cacheKey, 600, JSON.stringify(user));
    return user;
  }
  async getUserByEmail(email: string) {
    const cacheKey = `user:${email}`;
    //check redis cache
    const cachedUser = await this.redis.get(cacheKey);
    if (cachedUser) {
      console.log(`Cache HIT for user ${email}`);
      return JSON.parse(cachedUser);
    }
    console.log(`Cache Miss for user ${email}`);
    //Query database
    const user = await this.userModel.findOne({ email }).lean();
    if (!user) {
      throw new NotFoundException(`User with email ${email} not found`);
    }
    //Store in redis
    await this.redis.setex(cacheKey, 600, JSON.stringify(user));
    return user;
  }

  async updateUser(id: number, updateUserDto: any) {
    const updatedUser = await this.userModel
      .findByIdAndUpdate(id, updateUserDto, { new: true })
      .lean();
    if (!updatedUser) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    //Update cache
    const cacheKey = `user:${id}`;
    await this.redis.setex(cacheKey, 600, JSON.stringify(updatedUser));
    return updatedUser;
  }

  async deleteUser(id: number) {
    const deletedUser = await this.userModel.findByIdAndDelete(id).lean();
    if (!deletedUser) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    //Remove from cache
    const cacheKey = `user:${id}`;
    await this.redis.del(cacheKey);
    return deletedUser;
  }
}
