import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

import { TicketServiceModule } from './ticket-service.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    TicketServiceModule,
    {
      transport: Transport.KAFKA,

      options: {
        client: {
          clientId: 'seatlock-ticket-service',
          brokers: ['localhost:9092'],
        },

        consumer: {
          groupId: 'seatlock-ticket-service',
        },
        subscribe: {
          fromBeginning: true,
        },
      },
    },
  );

  app.enableShutdownHooks();

  await app.listen();

  console.log('Ticket Service is running');
}

bootstrap().catch((error: unknown) => {
  console.error('Ticket Service failed to start', error);

  process.exit(1);
});
