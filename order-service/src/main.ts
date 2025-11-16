import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  const port = process.env.PORT || 4001;
  await app.listen(port);
  console.log(`🚀 Order Service running on http://localhost:${port}`);
}
bootstrap().catch((err) => console.error('Failed to start server:', err));
