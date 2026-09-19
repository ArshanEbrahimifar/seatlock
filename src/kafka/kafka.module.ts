import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';

import { KafkaProducerService } from './kafka-producer/kafka-producer.service';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'KAFKA_CLIENT',
        inject: [ConfigService],

        useFactory: (configService: ConfigService) => ({
          transport: Transport.KAFKA,

          options: {
            client: {
              clientId: 'seatlock-api',
              brokers: configService
                .getOrThrow<string>('KAFKA_BROKERS')
                .split(',')
                .map((broker) => broker.trim()),
            },

            producerOnlyMode: true,
          },
        }),
      },
    ]),
  ],

  providers: [KafkaProducerService],
  exports: [KafkaProducerService],
})
export class KafkaModule {}
