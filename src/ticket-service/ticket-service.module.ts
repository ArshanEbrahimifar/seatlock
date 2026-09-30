import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { OrderEventsModule } from '../order-events/order-events.module';
import { OrderPaidConsumer } from './order-paid.consumer';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
    }),

    DatabaseModule,
    OrderEventsModule,
  ],
  controllers: [OrderPaidConsumer],
})
export class TicketServiceModule {}
