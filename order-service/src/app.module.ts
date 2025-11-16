import { Module } from '@nestjs/common';
import { OrderController } from './order/order.controller';
import { OrderService } from './order/order.services';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './order/order.entity';
import { RabbitMQService } from './rabbitmq/rabbitmq.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '3306', 10),
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      entities: [Order],
      synchronize: true,
      logging: true,
    }),
    TypeOrmModule.forFeature([Order]),
  ],
  controllers: [OrderController],
  providers: [OrderService, RabbitMQService],
})
export class AppModule {}
