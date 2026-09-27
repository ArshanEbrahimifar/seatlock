import { Module } from '@nestjs/common';
import { EventSeatsController } from './event-seats.controller';
import { EventSeatsService } from './event-seats.service';
import { DatabaseModule } from '../database/database.module';
import { EventSeatHoldsController } from '../event-seat-holds/event-seat-holds.controller';
import { OrderExpirationModule } from '../order-expiration/order-expiration.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [DatabaseModule, OrderExpirationModule, RealtimeModule],
  controllers: [EventSeatsController, EventSeatHoldsController],
  providers: [EventSeatsService],
})
export class EventSeatsModule {}
