import { Module } from '@nestjs/common';
import { OutboxDispatcherService } from './outbox-dispatcher/outbox-dispatcher.service';
import { DatabaseModule } from '../database/database.module';
import { OrderExpirationModule } from '../order-expiration/order-expiration.module';

@Module({
  imports: [DatabaseModule, OrderExpirationModule],
  providers: [OutboxDispatcherService],
})
export class OutboxModule {}
