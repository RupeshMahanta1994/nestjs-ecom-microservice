import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Order } from './order.entity';
import { Repository } from 'typeorm';
import { RabbitMQService } from 'src/rabbitmq/rabbitmq.service';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    private rabbitMQService: RabbitMQService,
  ) {}
  async createOrder(orderData: Partial<Order>): Promise<Order> {
    const newOrder = this.orderRepository.create(orderData);
    const savedOrder = await this.orderRepository.save(newOrder);

    // Publish order.created event to RabbitMQ
    await this.rabbitMQService.publishOrderCreated({
      orderId: savedOrder.id,
      userId: savedOrder.userId,
      productId: savedOrder.productId,
      quantity: savedOrder.quantity,
      price: savedOrder.price,
      timestamp: new Date().toISOString(),
    });

    return savedOrder;
  }

  async findOne(id: number): Promise<Order | null> {
    return this.orderRepository.findOne({ where: { id } });
  }

  async findAll(): Promise<Order[]> {
    return this.orderRepository.find();
  }

  async findByUser(userId: number): Promise<Order[]> {
    return this.orderRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }
}
