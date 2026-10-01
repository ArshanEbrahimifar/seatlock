import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OrderPaidConsumer } from './order-paid.consumer';
import { TicketingService } from './ticketing.service';
import { TicketingDatabaseService } from './ticketing-database.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
    }),
  ],
  controllers: [OrderPaidConsumer],
  providers: [TicketingService, TicketingDatabaseService],
})
export class TicketServiceModule {}
