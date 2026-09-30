import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { OrderPaidConsumer } from './order-paid.consumer';
import { TicketingService } from './ticketing.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
    }),

    DatabaseModule,
  ],
  controllers: [OrderPaidConsumer],
  providers: [TicketingService],
})
export class TicketServiceModule {}
