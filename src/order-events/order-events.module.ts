import { Module } from '@nestjs/common';
import { OrderEventsService } from './order-events.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [OrderEventsService],
  exports: [OrderEventsService],
})
export class OrderEventsModule {}
