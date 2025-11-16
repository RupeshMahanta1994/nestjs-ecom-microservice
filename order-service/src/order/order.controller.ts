import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  ParseIntPipe,
} from '@nestjs/common';
import { OrderService } from './order.services';
import { Order } from './order.entity';

@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  async createOrder(@Body() orderData: Partial<Order>) {
    return this.orderService.createOrder(orderData);
  }

  @Get()
  async getAllOrders() {
    return this.orderService.findAll();
  }

  @Get(':id')
  async getOrderById(@Param('id', ParseIntPipe) id: number) {
    return this.orderService.findOne(id);
  }

  @Get('user/:userId')
  async getOrdersByUser(@Param('userId', ParseIntPipe) userId: number) {
    return this.orderService.findByUser(userId);
  }
}
