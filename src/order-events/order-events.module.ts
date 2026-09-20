import { Module } from '@nestjs/common';
import { OrderEventsController } from './order-events/order-events.controller';
import { OrderEventsService } from './order-events.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [OrderEventsController],
  providers: [OrderEventsService],
})
export class OrderEventsModule {}
