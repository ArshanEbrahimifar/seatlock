import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { ConfigModule } from '@nestjs/config';
import { envSchema } from './config/env.Schema';
import { VenuesModule } from './venues/venues.module';
import { SeatsModule } from './seats/seats.module';
import { EventsModule } from './events/events.module';
import { EventSeatsModule } from './event-seats/event-seats.module';
import { OrdersModule } from './orders/orders.module';

@Module({
  imports: [
    DatabaseModule,
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: (config) => envSchema.parse(config),
    }),
    VenuesModule,
    SeatsModule,
    EventsModule,
    EventSeatsModule,
    OrdersModule,
  ],
})
export class AppModule {}
