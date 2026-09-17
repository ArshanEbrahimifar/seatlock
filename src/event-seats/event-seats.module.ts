import { Module } from '@nestjs/common';
import { EventSeatsController } from './event-seats.controller';
import { EventSeatsService } from './event-seats.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [EventSeatsController],
  providers: [EventSeatsService],
})
export class EventSeatsModule {}
