import '../telemetry/ticket.instrumentation';

import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

import { TicketServiceModule } from './ticket-service.module';

function getKafkaBrokers(): string[] {
  return (process.env.KAFKA_BROKERS ?? 'localhost:9092')
    .split(',')
    .map((broker) => broker.trim())
    .filter((broker) => broker.length > 0);
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    TicketServiceModule,
    {
      transport: Transport.KAFKA,

      options: {
        client: {
          clientId: 'seatlock-ticket-service',
          brokers: getKafkaBrokers(),
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
