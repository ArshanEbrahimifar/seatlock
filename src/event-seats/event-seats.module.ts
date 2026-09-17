import { Module } from '@nestjs/common';
import { EventSeatsController } from './event-seats.controller';
import { EventSeatsService } from './event-seats.service';
import { DatabaseModule } from '../database/database.module';
import { EventSeatHoldsController } from '../event-seat-holds/event-seat-holds.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [EventSeatsController, EventSeatHoldsController],
  providers: [EventSeatsService],
})
export class EventSeatsModule {}
