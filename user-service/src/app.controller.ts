import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { AppService } from './app.service';

@Controller('user')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post()
  async createUser(@Body() createUserDto: any) {
    return this.appService.createUser(createUserDto);
  }
  @Get(':id')
  async getUserById(@Param('id') id: number) {
    console.log(id);
    return this.appService.getUserById(id);
  }
  @Get('email/:email')
  async getUserByEmail(@Param('email') email: string) {
    return this.appService.getUserByEmail(email);
  }
  @Put(':id')
  async updateUser(@Param('id') id: number, @Body() updateUserDto: any) {
    return this.appService.updateUser(id, updateUserDto);
  }
  @Delete(':id')
  async deleteUser(@Param('id') id: number) {
    return this.appService.deleteUser(id);
  }
}
