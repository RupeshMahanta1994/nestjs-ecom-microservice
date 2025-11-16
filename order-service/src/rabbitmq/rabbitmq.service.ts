import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as amqp from 'amqplib';

interface OrderData {
  orderId: number;
  userId: number;
  productId: number;
  quantity: number;
  price: number;
  timestamp: string;
}

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private connection: amqp.Connection | null = null;
  private channel: amqp.Channel | null = null;

  async onModuleInit() {
    const rabbitmqUrl =
      process.env.RABBITMQ_URL || 'amqp://admin:adminpass@localhost:5672';

    try {
      this.connection = await amqp.connect(rabbitmqUrl);
      this.channel = await this.connection.createChannel();
      await this.channel.assertQueue('order.created', { durable: true });
      console.log('✅ RabbitMQ connected successfully');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Failed to connect to RabbitMQ:', errorMessage);
    }
  }

  async onModuleDestroy() {
    if (this.channel) {
      await this.channel.close();
    }
    if (this.connection) {
      await this.connection.close();
    }
    console.log('RabbitMQ connection closed');
  }

  async publishOrderCreated(orderData: OrderData): Promise<void> {
    if (!this.channel) {
      console.error('❌ RabbitMQ channel not available');
      return;
    }

    this.channel.sendToQueue(
      'order.created',
      Buffer.from(JSON.stringify(orderData)),
      { persistent: true },
    );
    console.log('📤 Published order.created event:', orderData.orderId);
  }
}
