import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { RedisIoAdapter } from './realtime/redis-io.adapter';
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableShutdownHooks();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const configService = app.get(ConfigService);

  const redisIoAdapter = new RedisIoAdapter(app, configService);

  await redisIoAdapter.connectToRedis();

  app.useWebSocketAdapter(redisIoAdapter);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: 'seatlock-consumer',
        brokers: configService
          .getOrThrow<string>('KAFKA_BROKERS')
          .split(',')
          .map((broker) => broker.trim()),
      },
      consumer: {
        groupId: 'seatlock-order-paid-consumer',
      },
    },
  });

  await app.startAllMicroservices();

  const port = configService.getOrThrow<number>('PORT');

  await app.listen(port);
}
bootstrap().catch((error: unknown) => {
  console.error('Application failed to start', error);
  process.exit(1);
});
