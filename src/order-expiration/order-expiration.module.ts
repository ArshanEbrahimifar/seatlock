import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { OrderExpirationService } from './order-expiration.service';
import { DatabaseModule } from '../database/database.module';
import { OrderExpirationProcessor } from './order-expiration.processor';

@Module({
  imports: [
    DatabaseModule,
    BullModule.registerQueue({
      name: 'order-expiration',
    }),
  ],
  providers: [OrderExpirationService, OrderExpirationProcessor],
  exports: [OrderExpirationService],
})
export class OrderExpirationModule {}
