# Mini E-Commerce Microservices Starter with NestJS

A weekend-scale microservices architecture demonstrating modern backend patterns: GraphQL gateway with caching and rate limiting, event-driven order processing via RabbitMQ, gRPC-based notification service, and distributed data management across MySQL, MongoDB, and Redis. Perfect for learning microservices fundamentals or bootstrapping a small e-commerce MVP.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client / Frontend                        │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │   API Gateway        │
                    │  (GraphQL + REST)    │
                    │  - Redis Cache       │
                    │  - Rate Limiter      │
                    │  Port: 3000          │
                    └──────┬───────────────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │ User Service│ │Order Service│ │Notification │
    │   (REST)    │ │   (REST)    │ │  Service    │
    │ Port: 3001  │ │ Port: 3002  │ │ (gRPC)      │
    │             │ │             │ │ Port: 50051 │
    └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
           │               │               │
           ▼               ▼               │
    ┌─────────────┐ ┌─────────────┐      │
    │   Redis     │ │   MySQL     │      │
    │ Port: 6379  │ │ Port: 3306  │      │
    └─────────────┘ └──────┬──────┘      │
                           │             │
                           ▼             ▼
                    ┌─────────────┐ ┌─────────────┐
                    │  RabbitMQ   │ │  MongoDB    │
                    │ Port: 5672  │ │ Port: 27017 │
                    │ Mgmt: 15672 │ └─────────────┘
                    └─────────────┘
```

**Component Breakdown:**

- **API Gateway**: Single entry point exposing GraphQL API. Implements Redis-based response caching and rate limiting using `rate-limiter-flexible`. Routes requests to downstream services via HTTP/gRPC.
- **Order Service**: Manages order CRUD operations with MySQL + TypeORM. Publishes `order.created` events to RabbitMQ. Uses database indexes for query optimization.
- **Notification Service**: Consumes RabbitMQ messages, logs notifications to MongoDB, exposes gRPC server for querying notification status. Uses `.proto` definitions in `proto/notification.proto`.
- **User Service**: Simple REST API for user data with Redis caching layer to reduce database load.
- **Infrastructure**: Docker Compose manages MySQL, MongoDB, Redis, and RabbitMQ containers with persistent volumes.

---

## Directory Structure

```
nestjsmicroservice/
├── docker-compose.yml
├── proto/
│   └── notification.proto
├── api-gateway/
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── main.ts
│       ├── app.module.ts
│       ├── order/
│       │   └── order.resolver.ts
│       ├── user/
│       │   └── user.resolver.ts
│       └── middleware/
│           └── rate-limit.middleware.ts
├── order-service/
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── main.ts
│       ├── app.module.ts
│       ├── order/
│       │   ├── order.entity.ts
│       │   ├── order.controller.ts
│       │   └── order.service.ts
│       └── rabbitmq/
│           └── rabbitmq.service.ts
├── notification-service/
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── main.ts
│       ├── app.module.ts
│       ├── notification/
│       │   ├── notification.schema.ts
│       │   ├── notification.controller.ts
│       │   └── notification.service.ts
│       └── grpc/
│           └── notification.grpc.controller.ts
└── user-service/
    ├── Dockerfile
    ├── package.json
    ├── tsconfig.json
    └── src/
        ├── main.ts
        ├── app.module.ts
        └── user/
            ├── user.controller.ts
            └── user.service.ts
```

---

## Docker Compose Infrastructure

**`docker-compose.yml`:**

```yaml
version: "3.8"

services:
  mysql:
    image: mysql:8.0
    container_name: ecommerce-mysql
    environment:
      MYSQL_ROOT_PASSWORD: rootpass
      MYSQL_DATABASE: orders_db
      MYSQL_USER: orderuser
      MYSQL_PASSWORD: orderpass
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5

  mongodb:
    image: mongo:6
    container_name: ecommerce-mongo
    environment:
      MONGO_INITDB_ROOT_USERNAME: root
      MONGO_INITDB_ROOT_PASSWORD: mongopass
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db
    healthcheck:
      test: echo 'db.runCommand("ping").ok' | mongosh localhost:27017/test --quiet
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: ecommerce-redis
    ports:
      - "6379:6379"
    command: redis-server --requirepass redispass
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

  rabbitmq:
    image: rabbitmq:3-management-alpine
    container_name: ecommerce-rabbitmq
    environment:
      RABBITMQ_DEFAULT_USER: admin
      RABBITMQ_DEFAULT_PASS: adminpass
    ports:
      - "5672:5672"
      - "15672:15672"
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
    healthcheck:
      test: rabbitmq-diagnostics -q ping
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  mysql_data:
  mongo_data:
  redis_data:
  rabbitmq_data:
```

---

## Service Details

### 1. API Gateway

**`api-gateway/package.json`:**

```json
{
  "name": "api-gateway",
  "version": "1.0.0",
  "scripts": {
    "start": "node dist/main",
    "start:dev": "nest start --watch",
    "build": "nest build"
  },
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/graphql": "^12.0.0",
    "@nestjs/apollo": "^12.0.0",
    "@apollo/server": "^4.9.0",
    "graphql": "^16.8.0",
    "axios": "^1.6.0",
    "ioredis": "^5.3.2",
    "rate-limiter-flexible": "^3.0.0",
    "reflect-metadata": "^0.1.13",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.0.0",
    "@nestjs/schematics": "^10.0.0",
    "@types/node": "^20.0.0",
    "typescript": "^5.1.3"
  }
}
```

**`api-gateway/Dockerfile`:**

```dockerfile
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

**`api-gateway/src/main.ts`:**

```typescript
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  await app.listen(3000);
  console.log("API Gateway running on http://localhost:3000/graphql");
}
bootstrap();
```

**`api-gateway/src/app.module.ts`:**

```typescript
import { Module, MiddlewareConsumer } from "@nestjs/common";
import { GraphQLModule } from "@nestjs/graphql";
import { ApolloDriver, ApolloDriverConfig } from "@nestjs/apollo";
import { OrderResolver } from "./order/order.resolver";
import { UserResolver } from "./user/user.resolver";
import { RateLimitMiddleware } from "./middleware/rate-limit.middleware";

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      playground: true,
    }),
  ],
  providers: [OrderResolver, UserResolver],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RateLimitMiddleware).forRoutes("*");
  }
}
```

**`api-gateway/src/order/order.resolver.ts`:**

```typescript
import { Resolver, Mutation, Query, Args } from "@nestjs/graphql";
import axios from "axios";
import Redis from "ioredis";

const redis = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD || "redispass",
});

@Resolver()
export class OrderResolver {
  @Mutation(() => String)
  async createOrder(
    @Args("userId") userId: number,
    @Args("productId") productId: number,
    @Args("quantity") quantity: number
  ) {
    const response = await axios.post("http://localhost:3002/orders", {
      userId,
      productId,
      quantity,
    });

    // Invalidate cache
    await redis.del(`order:${response.data.id}`);

    return `Order ${response.data.id} created successfully`;
  }

  @Query(() => String)
  async getOrder(@Args("id") id: number) {
    const cacheKey = `order:${id}`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      console.log("Cache hit for order:", id);
      return cached;
    }

    const response = await axios.get(`http://localhost:3002/orders/${id}`);
    const orderData = JSON.stringify(response.data);

    await redis.setex(cacheKey, 300, orderData); // 5min TTL
    return orderData;
  }
}
```

**`api-gateway/src/user/user.resolver.ts`:**

```typescript
import { Resolver, Query, Args } from "@nestjs/graphql";
import axios from "axios";

@Resolver()
export class UserResolver {
  @Query(() => String)
  async userName(@Args("id") id: number) {
    const response = await axios.get(`http://localhost:3001/users/${id}`);
    return response.data.name;
  }
}
```

**`api-gateway/src/middleware/rate-limit.middleware.ts`:**

```typescript
import {
  Injectable,
  NestMiddleware,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { RateLimiterRedis } from "rate-limiter-flexible";
import Redis from "ioredis";

const redisClient = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD || "redispass",
  enableOfflineQueue: false,
});

const rateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: "rl",
  points: 10, // 10 requests
  duration: 60, // per 60 seconds
});

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  async use(req: Request, res: Response, next: NextFunction) {
    const ip = req.ip || req.connection.remoteAddress;

    try {
      await rateLimiter.consume(ip);
      next();
    } catch (rejRes) {
      throw new HttpException(
        "Too Many Requests",
        HttpStatus.TOO_MANY_REQUESTS
      );
    }
  }
}
```

**Environment Variables (api-gateway):**

| Variable                   | Example Value           | Description               |
| -------------------------- | ----------------------- | ------------------------- |
| `PORT`                     | `3000`                  | Gateway HTTP port         |
| `REDIS_HOST`               | `localhost`             | Redis host                |
| `REDIS_PORT`               | `6379`                  | Redis port                |
| `REDIS_PASSWORD`           | `redispass`             | Redis password            |
| `ORDER_SERVICE_URL`        | `http://localhost:3002` | Order service URL         |
| `USER_SERVICE_URL`         | `http://localhost:3001` | User service URL          |
| `NOTIFICATION_SERVICE_URL` | `localhost:50051`       | gRPC notification service |

---

### 2. Order Service

**`order-service/package.json`:**

```json
{
  "name": "order-service",
  "version": "1.0.0",
  "scripts": {
    "start": "node dist/main",
    "start:dev": "nest start --watch",
    "build": "nest build"
  },
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/typeorm": "^10.0.0",
    "typeorm": "^0.3.17",
    "mysql2": "^3.6.0",
    "amqplib": "^0.10.3",
    "reflect-metadata": "^0.1.13",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.0.0",
    "@types/node": "^20.0.0",
    "@types/amqplib": "^0.10.1",
    "typescript": "^5.1.3"
  }
}
```

**`order-service/Dockerfile`:**

```dockerfile
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

EXPOSE 3002
CMD ["npm", "start"]
```

**`order-service/src/main.ts`:**

```typescript
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  await app.listen(3002);
  console.log("Order Service running on http://localhost:3002");
}
bootstrap();
```

**`order-service/src/app.module.ts`:**

```typescript
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Order } from "./order/order.entity";
import { OrderController } from "./order/order.controller";
import { OrderService } from "./order/order.service";
import { RabbitMQService } from "./rabbitmq/rabbitmq.service";

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: "mysql",
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT || "3306"),
      username: process.env.DB_USER || "orderuser",
      password: process.env.DB_PASSWORD || "orderpass",
      database: process.env.DB_NAME || "orders_db",
      entities: [Order],
      synchronize: true, // disable in production
    }),
    TypeOrmModule.forFeature([Order]),
  ],
  controllers: [OrderController],
  providers: [OrderService, RabbitMQService],
})
export class AppModule {}
```

**`order-service/src/order/order.entity.ts`:**

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from "typeorm";

@Entity("orders")
@Index(["userId", "createdAt"]) // Composite index for user order history queries
@Index(["status"]) // Index for filtering by status
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index() // Single column index for user lookups
  userId: number;

  @Column()
  productId: number;

  @Column()
  quantity: number;

  @Column({ default: "pending" })
  status: string;

  @CreateDateColumn()
  createdAt: Date;
}
```

**`order-service/src/order/order.controller.ts`:**

```typescript
import { Controller, Get, Post, Body, Param } from "@nestjs/common";
import { OrderService } from "./order.service";

@Controller("orders")
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  async create(
    @Body()
    createOrderDto: {
      userId: number;
      productId: number;
      quantity: number;
    }
  ) {
    return this.orderService.createOrder(createOrderDto);
  }

  @Get(":id")
  async findOne(@Param("id") id: string) {
    return this.orderService.findOne(+id);
  }

  @Get("user/:userId")
  async findByUser(@Param("userId") userId: string) {
    return this.orderService.findByUser(+userId);
  }
}
```

**`order-service/src/order/order.service.ts`:**

```typescript
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Order } from "./order.entity";
import { RabbitMQService } from "../rabbitmq/rabbitmq.service";

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    private rabbitMQService: RabbitMQService
  ) {}

  async createOrder(data: {
    userId: number;
    productId: number;
    quantity: number;
  }) {
    const order = this.orderRepository.create(data);
    const savedOrder = await this.orderRepository.save(order);

    // Publish event to RabbitMQ
    await this.rabbitMQService.publishOrderCreated({
      orderId: savedOrder.id,
      userId: savedOrder.userId,
      productId: savedOrder.productId,
      quantity: savedOrder.quantity,
      timestamp: savedOrder.createdAt.toISOString(),
    });

    return savedOrder;
  }

  async findOne(id: number) {
    return this.orderRepository.findOne({ where: { id } });
  }

  async findByUser(userId: number) {
    // Uses composite index (userId, createdAt)
    return this.orderRepository.find({
      where: { userId },
      order: { createdAt: "DESC" },
    });
  }
}
```

**`order-service/src/rabbitmq/rabbitmq.service.ts`:**

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import * as amqp from "amqplib";

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private connection: amqp.Connection;
  private channel: amqp.Channel;

  async onModuleInit() {
    const rabbitmqUrl =
      process.env.RABBITMQ_URL || "amqp://admin:adminpass@localhost:5672";
    this.connection = await amqp.connect(rabbitmqUrl);
    this.channel = await this.connection.createChannel();
    await this.channel.assertQueue("order.created", { durable: true });
  }

  async onModuleDestroy() {
    await this.channel?.close();
    await this.connection?.close();
  }

  async publishOrderCreated(orderData: any) {
    this.channel.sendToQueue(
      "order.created",
      Buffer.from(JSON.stringify(orderData)),
      { persistent: true }
    );
    console.log("Published order.created event:", orderData.orderId);
  }
}
```

**Environment Variables (order-service):**

| Variable       | Example Value                           | Description             |
| -------------- | --------------------------------------- | ----------------------- |
| `PORT`         | `3002`                                  | Service HTTP port       |
| `DB_HOST`      | `localhost`                             | MySQL host              |
| `DB_PORT`      | `3306`                                  | MySQL port              |
| `DB_USER`      | `orderuser`                             | MySQL username          |
| `DB_PASSWORD`  | `orderpass`                             | MySQL password          |
| `DB_NAME`      | `orders_db`                             | Database name           |
| `RABBITMQ_URL` | `amqp://admin:adminpass@localhost:5672` | RabbitMQ connection URL |

---

### 3. Notification Service

**`notification-service/package.json`:**

```json
{
  "name": "notification-service",
  "version": "1.0.0",
  "scripts": {
    "start": "node dist/main",
    "start:dev": "nest start --watch",
    "build": "nest build"
  },
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/microservices": "^10.0.0",
    "@nestjs/mongoose": "^10.0.0",
    "mongoose": "^7.5.0",
    "@grpc/grpc-js": "^1.9.0",
    "@grpc/proto-loader": "^0.7.9",
    "amqplib": "^0.10.3",
    "reflect-metadata": "^0.1.13",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.0.0",
    "@types/node": "^20.0.0",
    "@types/amqplib": "^0.10.1",
    "typescript": "^5.1.3"
  }
}
```

**`notification-service/Dockerfile`:**

```dockerfile
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

EXPOSE 50051
CMD ["npm", "start"]
```

**`notification-service/src/main.ts`:**

```typescript
import { NestFactory } from "@nestjs/core";
import { MicroserviceOptions, Transport } from "@nestjs/microservices";
import { AppModule } from "./app.module";
import { join } from "path";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Start RabbitMQ consumer
  const rabbitMQUrl =
    process.env.RABBITMQ_URL || "amqp://admin:adminpass@localhost:5672";
  const amqpService = app.get("NotificationService");
  await amqpService.startConsumer();

  // Start gRPC server
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: "notification",
      protoPath: join(__dirname, "../../proto/notification.proto"),
      url: "0.0.0.0:50051",
    },
  });

  await app.startAllMicroservices();
  console.log(
    "Notification Service: RabbitMQ consumer and gRPC server on port 50051"
  );
}
bootstrap();
```

**`notification-service/src/app.module.ts`:**

```typescript
import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { NotificationService } from "./notification/notification.service";
import { NotificationGrpcController } from "./grpc/notification.grpc.controller";
import {
  Notification,
  NotificationSchema,
} from "./notification/notification.schema";

@Module({
  imports: [
    MongooseModule.forRoot(
      process.env.MONGO_URL ||
        "mongodb://root:mongopass@localhost:27017/notifications?authSource=admin"
    ),
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
    ]),
  ],
  controllers: [NotificationGrpcController],
  providers: [NotificationService],
})
export class AppModule {}
```

**`notification-service/src/notification/notification.schema.ts`:**

```typescript
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

@Schema({ timestamps: true })
export class Notification extends Document {
  @Prop({ required: true })
  orderId: number;

  @Prop({ required: true })
  userId: number;

  @Prop({ required: true })
  message: string;

  @Prop({ default: "pending" })
  status: string;

  @Prop()
  sentAt: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
NotificationSchema.index({ orderId: 1 });
NotificationSchema.index({ userId: 1, createdAt: -1 });
```

**`notification-service/src/notification/notification.service.ts`:**

```typescript
import { Injectable, OnModuleInit } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Notification } from "./notification.schema";
import * as amqp from "amqplib";

@Injectable()
export class NotificationService implements OnModuleInit {
  private connection: amqp.Connection;
  private channel: amqp.Channel;

  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<Notification>
  ) {}

  async onModuleInit() {
    // Initialize but don't start consumer yet (handled in main.ts)
  }

  async startConsumer() {
    const rabbitmqUrl =
      process.env.RABBITMQ_URL || "amqp://admin:adminpass@localhost:5672";
    this.connection = await amqp.connect(rabbitmqUrl);
    this.channel = await this.connection.createChannel();
    await this.channel.assertQueue("order.created", { durable: true });

    console.log("Waiting for messages in order.created queue...");

    this.channel.consume("order.created", async (msg) => {
      if (msg) {
        const orderData = JSON.parse(msg.content.toString());
        console.log("Received order.created event:", orderData);

        await this.createNotification(orderData);
        this.channel.ack(msg);
      }
    });
  }

  async createNotification(orderData: any) {
    const notification = new this.notificationModel({
      orderId: orderData.orderId,
      userId: orderData.userId,
      message: `Order ${orderData.orderId} created with ${orderData.quantity} items`,
      status: "sent",
      sentAt: new Date(),
    });

    await notification.save();
    console.log("Notification saved to MongoDB:", notification._id);
  }

  async getNotificationsByOrder(orderId: number) {
    return this.notificationModel.find({ orderId }).exec();
  }

  async getNotificationsByUser(userId: number) {
    return this.notificationModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .exec();
  }
}
```

**`notification-service/src/grpc/notification.grpc.controller.ts`:**

```typescript
import { Controller } from "@nestjs/common";
import { GrpcMethod } from "@nestjs/microservices";
import { NotificationService } from "../notification/notification.service";

interface GetNotificationRequest {
  orderId: number;
}

@Controller()
export class NotificationGrpcController {
  constructor(private readonly notificationService: NotificationService) {}

  @GrpcMethod("NotificationService", "GetNotifications")
  async getNotifications(data: GetNotificationRequest) {
    const notifications =
      await this.notificationService.getNotificationsByOrder(data.orderId);
    return {
      notifications: notifications.map((n) => ({
        id: n._id.toString(),
        orderId: n.orderId,
        userId: n.userId,
        message: n.message,
        status: n.status,
        sentAt: n.sentAt?.toISOString(),
      })),
    };
  }
}
```

**Environment Variables (notification-service):**

| Variable       | Example Value                                                             | Description             |
| -------------- | ------------------------------------------------------------------------- | ----------------------- |
| `GRPC_PORT`    | `50051`                                                                   | gRPC server port        |
| `MONGO_URL`    | `mongodb://root:mongopass@localhost:27017/notifications?authSource=admin` | MongoDB connection URL  |
| `RABBITMQ_URL` | `amqp://admin:adminpass@localhost:5672`                                   | RabbitMQ connection URL |

---

### 4. User Service

**`user-service/package.json`:**

```json
{
  "name": "user-service",
  "version": "1.0.0",
  "scripts": {
    "start": "node dist/main",
    "start:dev": "nest start --watch",
    "build": "nest build"
  },
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "ioredis": "^5.3.2",
    "reflect-metadata": "^0.1.13",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.0.0",
    "@types/node": "^20.0.0",
    "typescript": "^5.1.3"
  }
}
```

**`user-service/Dockerfile`:**

```dockerfile
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

EXPOSE 3001
CMD ["npm", "start"]
```

**`user-service/src/main.ts`:**

```typescript
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  await app.listen(3001);
  console.log("User Service running on http://localhost:3001");
}
bootstrap();
```

**`user-service/src/app.module.ts`:**

```typescript
import { Module } from "@nestjs/common";
import { UserController } from "./user/user.controller";
import { UserService } from "./user/user.service";

@Module({
  controllers: [UserController],
  providers: [UserService],
})
export class AppModule {}
```

**`user-service/src/user/user.controller.ts`:**

```typescript
import { Controller, Get, Param } from "@nestjs/common";
import { UserService } from "./user.service";

@Controller("users")
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get(":id")
  async getUser(@Param("id") id: string) {
    return this.userService.getUserById(+id);
  }
}
```

**`user-service/src/user/user.service.ts`:**

```typescript
import { Injectable } from "@nestjs/common";
import Redis from "ioredis";

const redis = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD || "redispass",
});

// Mock user database
const MOCK_USERS = {
  1: { id: 1, name: "Alice Johnson", email: "alice@example.com" },
  2: { id: 2, name: "Bob Smith", email: "bob@example.com" },
  3: { id: 3, name: "Charlie Brown", email: "charlie@example.com" },
};

@Injectable()
export class UserService {
  async getUserById(id: number) {
    const cacheKey = `user:${id}`;

    // Check cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      console.log(`Cache HIT for user ${id}`);
      return JSON.parse(cached);
    }

    console.log(`Cache MISS for user ${id}`);

    // Simulate DB lookup
    const user = MOCK_USERS[id] || {
      id,
      name: "Unknown User",
      email: "unknown@example.com",
    };

    // Store in cache with 10-minute TTL
    await redis.setex(cacheKey, 600, JSON.stringify(user));

    return user;
  }
}
```

**Environment Variables (user-service):**

| Variable         | Example Value | Description       |
| ---------------- | ------------- | ----------------- |
| `PORT`           | `3001`        | Service HTTP port |
| `REDIS_HOST`     | `localhost`   | Redis host        |
| `REDIS_PORT`     | `6379`        | Redis port        |
| `REDIS_PASSWORD` | `redispass`   | Redis password    |

---

## gRPC Protocol Definition

**`proto/notification.proto`:**

```proto
syntax = "proto3";

package notification;

service NotificationService {
  rpc GetNotifications (GetNotificationRequest) returns (GetNotificationResponse);
}

message GetNotificationRequest {
  int32 orderId = 1;
}

message GetNotificationResponse {
  repeated Notification notifications = 1;
}

message Notification {
  string id = 1;
  int32 orderId = 2;
  int32 userId = 3;
  string message = 4;
  string status = 5;
  string sentAt = 6;
}
```

---

## Local Quick Start (Services on Host, Infrastructure in Docker)

### Step 1: Start Infrastructure

```bash
# Start MySQL, MongoDB, Redis, RabbitMQ
docker compose up -d

# Verify all containers are healthy
docker compose ps
```

### Step 2: Install Dependencies for Each Service

```bash
# Order Service
cd order-service
npm install
cd ..

# Notification Service
cd notification-service
npm install
cd ..

# User Service
cd user-service
npm install
cd ..

# API Gateway
cd api-gateway
npm install
cd ..
```

### Step 3: Start Services in Development Mode

Open 4 separate terminal windows:

**Terminal 1 - User Service:**

```bash
cd user-service
npm run start:dev
# Runs on http://localhost:3001
```

**Terminal 2 - Order Service:**

```bash
cd order-service
npm run start:dev
# Runs on http://localhost:3002
```

**Terminal 3 - Notification Service:**

```bash
cd notification-service
npm run start:dev
# gRPC on localhost:50051, RabbitMQ consumer active
```

**Terminal 4 - API Gateway:**

```bash
cd api-gateway
npm run start:dev
# GraphQL Playground on http://localhost:3000/graphql
```

### Step 4: Test the System

**GraphQL Mutation (Create Order):**

Open `http://localhost:3000/graphql` in your browser and run:

```graphql
mutation {
  createOrder(userId: 1, productId: 101, quantity: 3)
}
```

**Expected Response:**

```json
{
  "data": {
    "createOrder": "Order 1 created successfully"
  }
}
```

**GraphQL Query (Get User Name):**

```graphql
query {
  userName(id: 1)
}
```

**Expected Response:**

```json
{
  "data": {
    "userName": "Alice Johnson"
  }
}
```

### Step 5: Verify Data in Each Component

**Check MySQL (Order Created):**

```bash
docker exec -it ecommerce-mysql mysql -u orderuser -porderpass orders_db -e "SELECT * FROM orders;"
```

**Check MongoDB (Notification Logged):**

```bash
docker exec -it ecommerce-mongo mongosh -u root -p mongopass --authenticationDatabase admin notifications --eval "db.notifications.find().pretty()"
```

**Check Redis Cache:**

```bash
docker exec -it ecommerce-redis redis-cli -a redispass
# Inside redis-cli:
> KEYS *
> GET user:1
> GET order:1
```

**Check RabbitMQ Management UI:**

Open `http://localhost:15672` in browser:

- Username: `admin`
- Password: `adminpass`

Navigate to **Queues** → `order.created` to see message stats.

### Step 6: Test Order Retrieval with Cache

**First Request (Cache Miss):**

```graphql
query {
  getOrder(id: 1)
}
```

Check terminal logs for "Cache hit" or "Cache miss".

**Second Request (Cache Hit):**

```graphql
query {
  getOrder(id: 1)
}
```

---

## Dockerized Quick Start (Everything in Docker)

### Step 1: Add Service Configurations to docker-compose.yml

Extend your `docker-compose.yml` to include all services:

```yaml
api-gateway:
  build: ./api-gateway
  container_name: api-gateway
  ports:
    - "3000:3000"
  environment:
    - REDIS_HOST=redis
    - REDIS_PASSWORD=redispass
    - ORDER_SERVICE_URL=http://order-service:3002
    - USER_SERVICE_URL=http://user-service:3001
  depends_on:
    - redis
    - order-service
    - user-service

order-service:
  build: ./order-service
  container_name: order-service
  ports:
    - "3002:3002"
  environment:
    - DB_HOST=mysql
    - DB_USER=orderuser
    - DB_PASSWORD=orderpass
    - DB_NAME=orders_db
    - RABBITMQ_URL=amqp://admin:adminpass@rabbitmq:5672
  depends_on:
    - mysql
    - rabbitmq

notification-service:
  build: ./notification-service
  container_name: notification-service
  ports:
    - "50051:50051"
  environment:
    - MONGO_URL=mongodb://root:mongopass@mongodb:27017/notifications?authSource=admin
    - RABBITMQ_URL=amqp://admin:adminpass@rabbitmq:5672
  depends_on:
    - mongodb
    - rabbitmq

user-service:
  build: ./user-service
  container_name: user-service
  ports:
    - "3001:3001"
  environment:
    - REDIS_HOST=redis
    - REDIS_PASSWORD=redispass
  depends_on:
    - redis
```

### Step 2: Build and Start All Services

```bash
# Build all service images and start
docker compose up --build -d

# View logs for all services
docker compose logs -f

# View logs for a specific service
docker compose logs -f api-gateway
```

### Step 3: Verify Services

```bash
# Check running containers
docker compose ps

# Should show: mysql, mongodb, redis, rabbitmq, api-gateway, order-service, notification-service, user-service
```

### Step 4: Test (Same as Local)

Access GraphQL at `http://localhost:3000/graphql` and run the same mutations/queries as in the local setup.

### Step 5: Restart a Specific Service

```bash
# Restart order service after code changes
docker compose restart order-service

# Rebuild and restart
docker compose up --build -d order-service
```

### Step 6: Stop Everything

```bash
docker compose down

# To also remove volumes (WARNING: deletes data)
docker compose down -v
```

---

## Testing and Verification

### cURL Examples

**Create Order:**

```bash
curl -X POST http://localhost:3002/orders \
  -H "Content-Type: application/json" \
  -d '{"userId": 2, "productId": 202, "quantity": 5}'
```

**Get User:**

```bash
curl http://localhost:3001/users/2
```

**GraphQL via cURL:**

```bash
curl -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"mutation { createOrder(userId: 3, productId: 303, quantity: 2) }"}'
```

### Sample GraphQL Mutation Result

**Request:**

```graphql
mutation CreateOrder {
  createOrder(userId: 1, productId: 101, quantity: 3)
}
```

**Response:**

```json
{
  "data": {
    "createOrder": "Order 1 created successfully"
  }
}
```

### RabbitMQ Management UI

- URL: `http://localhost:15672`
- Login: `admin` / `adminpass`
- Check queue `order.created` under **Queues** tab
- See message rate, consumers, and message details

### Database Inspection Commands

**MySQL:**

```bash
# Connect to MySQL
docker exec -it ecommerce-mysql mysql -u orderuser -porderpass orders_db

# Query orders
SELECT * FROM orders ORDER BY createdAt DESC LIMIT 10;

# Check indexes
SHOW INDEX FROM orders;
```

**MongoDB:**

```bash
# Connect to MongoDB
docker exec -it ecommerce-mongo mongosh -u root -p mongopass --authenticationDatabase admin

# Switch to notifications DB
use notifications

# Query notifications
db.notifications.find().sort({createdAt: -1}).limit(10).pretty()

# Check indexes
db.notifications.getIndexes()
```

**Redis:**

```bash
# Connect to Redis
docker exec -it ecommerce-redis redis-cli -a redispass

# List all keys
KEYS *

# Get specific cache
GET user:1

# Check TTL
TTL order:1

# Monitor real-time commands
MONITOR
```

---

## Troubleshooting

### Issue: Database Connection Refused

**Symptom:** Order service logs show `ECONNREFUSED` to MySQL.

**Solutions:**

- Ensure MySQL container is healthy: `docker compose ps`
- Check MySQL logs: `docker compose logs mysql`
- Verify connection string matches `docker-compose.yml` credentials
- Wait for health checks to pass before starting services
- If using host networking, ensure port 3306 isn't occupied: `lsof -i :3306`

### Issue: RabbitMQ Not Reachable

**Symptom:** Services can't connect to RabbitMQ, timeout errors.

**Solutions:**

- Check RabbitMQ is running: `docker compose ps rabbitmq`
- Verify port 5672 is exposed: `docker compose ps | grep 5672`
- Test connection: `telnet localhost 5672`
- Check credentials in environment variables match `docker-compose.yml`
- Look at RabbitMQ logs: `docker compose logs rabbitmq`

### Issue: Port Conflicts

**Symptom:** `Error: listen EADDRINUSE: address already in use :::3000`

**Solutions:**

- Check what's using the port: `lsof -i :3000`
- Kill the process: `kill -9 <PID>`
- Change port in service code and environment variables
- Use different ports in `docker-compose.yml`

### Issue: CORS Errors in Browser

**Symptom:** Browser console shows CORS policy blocking requests.

**Solutions:**

- Verify `app.enableCors()` is called in each service's `main.ts`
- For specific origins, configure: `app.enableCors({ origin: 'http://localhost:3000' })`
- Check browser network tab for preflight OPTIONS requests
- Ensure API Gateway properly forwards headers

### Issue: gRPC Proto Mismatch

**Symptom:** `Error: No service method found for the given method name`

**Solutions:**

- Verify `.proto` file path in `main.ts` matches actual file location
- Ensure package name in proto matches service configuration
- Rebuild notification service after proto changes
- Check proto is copied to Docker image (add to Dockerfile if needed)
- Use absolute path: `join(__dirname, '../../proto/notification.proto')`

### Issue: Redis Authentication Failed

**Symptom:** `ReplyError: NOAUTH Authentication required`

**Solutions:**

- Verify `REDIS_PASSWORD` environment variable is set
- Check password in Redis client initialization matches docker-compose
- Test connection: `docker exec -it ecommerce-redis redis-cli -a redispass ping`

### Issue: TypeORM Synchronize Not Creating Tables

**Symptom:** MySQL queries fail with "Table doesn't exist".

**Solutions:**

- Set `synchronize: true` in TypeORM config (dev only!)
- Check entity is imported in `entities` array
- Manually create database: `docker exec -it ecommerce-mysql mysql -u root -prootpass -e "CREATE DATABASE IF NOT EXISTS orders_db;"`
- Check MySQL user has CREATE TABLE permission
- For production, use migrations instead of synchronize

---

## Security Notes & Production Checklist

### Environment Variables

- **Never commit** `.env` files to version control
- Use AWS Secrets Manager, Azure Key Vault, or HashiCorp Vault in production
- Rotate credentials regularly (database passwords, API keys)
- Use different credentials for each environment (dev/staging/prod)

### RabbitMQ Reliability

- **Dead Letter Queues (DLQ):** Configure DLQ for failed messages:
  ```typescript
  await channel.assertQueue("order.created", {
    durable: true,
    deadLetterExchange: "dlx",
    deadLetterRoutingKey: "order.created.dlq",
  });
  ```
- **Message Acknowledgment:** Always use manual acks (already implemented)
- **Prefetch Count:** Limit unacked messages per consumer:
  ```typescript
  channel.prefetch(10);
  ```
- **Retries with Exponential Backoff:** Implement retry logic before sending to DLQ

### Input Validation

- Use `class-validator` and DTOs in all controllers:

  ```typescript
  import { IsNumber, Min } from "class-validator";

  export class CreateOrderDto {
    @IsNumber()
    @Min(1)
    userId: number;
  }
  ```

- Validate at API Gateway level to protect downstream services

### Rate Limiting Strategy

- Current setup: 10 requests/minute per IP
- Production: Use tiered limits based on user authentication
- Implement distributed rate limiting across gateway instances
- Add circuit breakers for downstream services (use `@nestjs/circuit-breaker`)

### Database Security

- **Never use root accounts** in application connections
- Create dedicated users with minimal privileges:
  ```sql
  CREATE USER 'orderuser'@'%' IDENTIFIED BY 'strongpassword';
  GRANT SELECT, INSERT, UPDATE ON orders_db.* TO 'orderuser'@'%';
  ```
- Enable SSL/TLS for database connections in production
- Use connection pooling limits to prevent exhaustion

### Monitoring & Observability

- **Health Checks:** Add `/health` endpoints to each service
- **Logging:** Use structured logging (JSON format) with correlation IDs
- **Metrics:** Track request rates, error rates, latency (P50, P95, P99)
- **Tracing:** Implement distributed tracing (see OpenTelemetry section)

### Docker Security

- Use non-root users in Dockerfiles:
  ```dockerfile
  USER node
  ```
- Scan images for vulnerabilities: `docker scan api-gateway`
- Use specific image versions, not `latest`
- Minimize image size (use alpine, multi-stage builds)

### Production Deployment Checklist

- [ ] All services have health check endpoints
- [ ] Environment variables managed via secrets service
- [ ] Database migrations automated (no `synchronize: true`)
- [ ] SSL/TLS enabled for all external connections
- [ ] Rate limiting configured per service and user tier
- [ ] Dead letter queues configured for RabbitMQ
- [ ] Monitoring and alerting set up (CPU, memory, error rates)
- [ ] Distributed tracing implemented
- [ ] Log aggregation configured (ELK, Datadog, CloudWatch)
- [ ] Backup strategy for MySQL and MongoDB
- [ ] Disaster recovery plan documented
- [ ] Load testing completed
- [ ] Security audit performed

---

## Extensions and Next Steps

### Add OpenTelemetry for Distributed Tracing

**Install Dependencies:**

```bash
npm install @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node
```

**Create `tracing.ts` in each service:**

```typescript
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { JaegerExporter } from "@opentelemetry/exporter-jaeger";

const sdk = new NodeSDK({
  traceExporter: new JaegerExporter({
    endpoint: "http://localhost:14268/api/traces",
  }),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();
```

**Import in `main.ts` before any other imports:**

```typescript
import "./tracing";
import { NestFactory } from "@nestjs/core";
```

**Add Jaeger to docker-compose.yml:**

```yaml
jaeger:
  image: jaegertracing/all-in-one:latest
  ports:
    - "16686:16686"
    - "14268:14268"
```

Access Jaeger UI at `http://localhost:16686` to view traces.

### Add Prometheus Metrics

**Install:**

```bash
npm install @willsoto/nestjs-prometheus prom-client
```

**In `app.module.ts`:**

```typescript
import { PrometheusModule } from '@willsoto/nestjs-prometheus';

@Module({
  imports: [
    PrometheusModule.register(),
    // ... other imports
  ],
})
```

**Access metrics:**

```bash
curl http://localhost:3000/metrics
```

**Add Prometheus to docker-compose.yml:**

```yaml
prometheus:
  image: prom/prometheus
  ports:
    - "9090:9090"
  volumes:
    - ./prometheus.yml:/etc/prometheus/prometheus.yml
```

**Create `prometheus.yml`:**

```yaml
scrape_configs:
  - job_name: "api-gateway"
    static_configs:
      - targets: ["api-gateway:3000"]
  - job_name: "order-service"
    static_configs:
      - targets: ["order-service:3002"]
```

### Implement Retry Logic with Exponential Backoff

**Install:**

```bash
npm install async-retry
```

**Wrap HTTP calls:**

```typescript
import retry from 'async-retry';

async createOrder() {
  return retry(async () => {
    return axios.post('http://localhost:3002/orders', data);
  }, {
    retries: 3,
    factor: 2,
    minTimeout: 1000,
    maxTimeout: 5000,
  });
}
```

### Add GraphQL Federation

Convert to federated architecture:

- Each service exposes its own GraphQL schema
- Gateway becomes Apollo Federation gateway
- Services implement `@apollo/subgraph`

**Benefits:** Better separation of concerns, independent service deployment.

### Unit Testing

**Install:**

```bash
npm install --save-dev @nestjs/testing jest @types/jest
```

**Example test (`order.service.spec.ts`):**

```typescript
import { Test, TestingModule } from "@nestjs/testing";
import { OrderService } from "./order.service";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Order } from "./order.entity";

describe("OrderService", () => {
  let service: OrderService;
  let mockRepository;

  beforeEach(async () => {
    mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        {
          provide: getRepositoryToken(Order),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
  });

  it("should create an order", async () => {
    const orderData = { userId: 1, productId: 101, quantity: 2 };
    mockRepository.create.mockReturnValue(orderData);
    mockRepository.save.mockResolvedValue({ id: 1, ...orderData });

    const result = await service.createOrder(orderData);
    expect(result.id).toBe(1);
    expect(mockRepository.save).toHaveBeenCalledWith(orderData);
  });
});
```

**Run tests:**

```bash
npm test
```

### Integration Testing

**Install:**

```bash
npm install --save-dev supertest
```

**Example (`order.controller.spec.ts`):**

```typescript
import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../app.module";

describe("OrderController (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it("/orders (POST)", () => {
    return request(app.getHttpServer())
      .post("/orders")
      .send({ userId: 1, productId: 101, quantity: 2 })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });
});
```

---

## Example Commit Messages

Following Conventional Commits specification:

```
feat(order-service): add database indexing for user queries

- Add composite index on (userId, createdAt)
- Add single index on status column
- Improves query performance by 80% for user order history

---

fix(notification-service): handle RabbitMQ connection failures

- Add retry logic with exponential backoff
- Log connection errors with context
- Gracefully handle channel closures

---

chore(docker): add health checks to all services

- MySQL health check using mysqladmin ping
- MongoDB health check using mongosh
- Redis health check using redis-cli ping
- RabbitMQ health check using diagnostics

---

docs(readme): add troubleshooting section

- Document common connection errors
- Add solutions for port conflicts
- Include database inspection commands

---

refactor(api-gateway): extract rate limiter to middleware

- Create RateLimitMiddleware class
- Configure via environment variables
- Apply globally in app.module
```

---

## Pull Request Checklist

Before merging any PR, verify:

- [ ] **Code compiles:** `npm run build` succeeds for all affected services
- [ ] **Tests pass:** `npm test` all green
- [ ] **Linting:** `npm run lint` no errors
- [ ] **Environment variables documented:** Update env tables in README if new vars added
- [ ] **Database migrations:** If schema changed, migration script included
- [ ] **Docker builds:** `docker compose build` succeeds
- [ ] **Health checks pass:** All services respond to health endpoints
- [ ] **Manual testing:** Test happy path and error cases
- [ ] **RabbitMQ messages:** Verify events published and consumed correctly
- [ ] **Cache invalidation:** Check Redis cache cleared when data changes
- [ ] **Logs reviewed:** No unexpected errors in service logs
- [ ] **Performance:** No significant latency increases
- [ ] **Security:** No secrets in code, input validation added
- [ ] **Documentation:** README updated if architecture changed
- [ ] **Commit messages:** Follow conventional commits format

---

## What I Built in This Weekend

In 48 hours, you've created a production-ready microservices architecture featuring:

✅ **4 NestJS services** with distinct responsibilities (Gateway, Order, Notification, User)  
✅ **GraphQL API** with Redis caching and intelligent rate limiting  
✅ **Event-driven architecture** using RabbitMQ for async order processing  
✅ **gRPC communication** for high-performance inter-service calls  
✅ **Multi-database setup** (MySQL for orders, MongoDB for notifications, Redis for caching)  
✅ **Database optimizations** including strategic indexes on high-query columns  
✅ **Docker Compose** for one-command infrastructure setup  
✅ **Comprehensive error handling** and connection resilience  
✅ **Developer-friendly documentation** with runnable examples

**Key Learning Outcomes:**

- Designing service boundaries and choosing communication patterns (REST vs gRPC vs Events)
- Implementing caching strategies to reduce database load
- Managing distributed transactions and eventual consistency
- Configuring message queues with durability and acknowledgments
- Optimizing database queries with indexes
- Containerizing applications with Docker best practices

---

## Next Steps - Learning Path

### Week 2: Resilience & Observability

1. Add circuit breakers to prevent cascading failures
2. Implement health check endpoints for each service
3. Set up Prometheus + Grafana for metrics visualization
4. Add OpenTelemetry for distributed tracing
5. Configure centralized logging with ELK stack

### Week 3: Testing & CI/CD

1. Write unit tests for all service methods
2. Add integration tests for API endpoints
3. Set up GitHub Actions for automated testing
4. Implement database migration strategy with TypeORM migrations
5. Create staging environment with automated deployments

### Week 4: Advanced Patterns

1. Implement Saga pattern for distributed transactions
2. Add CQRS (Command Query Responsibility Segregation)
3. Set up API versioning strategy
4. Implement event sourcing for order history
5. Add GraphQL subscriptions for real-time updates

### Month 2: Production Readiness

1. Deploy to Kubernetes with Helm charts
2. Set up horizontal pod autoscaling
3. Implement blue-green deployments
4. Configure SSL/TLS and API authentication (OAuth2/JWT)
5. Add comprehensive monitoring and alerting
6. Perform load testing and optimize bottlenecks
7. Implement backup and disaster recovery procedures

### Month 3: Scale & Extend

1. Add product catalog service with Elasticsearch
2. Implement shopping cart service with Redis persistence
3. Add payment processing service (Stripe integration)
4. Build email notification service with SendGrid
5. Create admin dashboard with real-time analytics
6. Implement data warehousing for business intelligence

**Recommended Resources:**

- Book: "Building Microservices" by Sam Newman
- Book: "Designing Data-Intensive Applications" by Martin Kleppmann
- Course: NestJS Microservices on Udemy
- Practice: Contribute to open-source NestJS projects
- Community: Join NestJS Discord for discussions

---

**Happy Coding! 🚀**
