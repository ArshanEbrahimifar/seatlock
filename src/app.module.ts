import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { envSchema } from './config/env.Schema';
import { VenuesModule } from './venues/venues.module';
import { SeatsModule } from './seats/seats.module';
import { EventsModule } from './events/events.module';
import { EventSeatsModule } from './event-seats/event-seats.module';
import { OrdersModule } from './orders/orders.module';
import { OrderExpirationModule } from './order-expiration/order-expiration.module';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { OutboxModule } from './outbox/outbox.module';
@Module({
  imports: [
    DatabaseModule,
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: (config) => envSchema.parse(config),
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],

      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.getOrThrow<string>('REDIS_HOST'),
          port: configService.getOrThrow<number>('REDIS_PORT'),
        },
      }),
    }),
    ScheduleModule.forRoot(),
    VenuesModule,
    SeatsModule,
    EventsModule,
    EventSeatsModule,
    OrdersModule,
    OrderExpirationModule,
    OutboxModule,
  ],
})
export class AppModule {}
