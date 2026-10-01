import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { DatabaseModule } from '../database/database.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [DatabaseModule, RealtimeModule, MetricsModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
