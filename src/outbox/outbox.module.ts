import { Module } from '@nestjs/common';
import { OutboxDispatcherService } from './outbox-dispatcher/outbox-dispatcher.service';
import { DatabaseModule } from '../database/database.module';
import { OrderExpirationModule } from '../order-expiration/order-expiration.module';
import { KafkaModule } from '../kafka/kafka.module';
import { OutboxAdminService } from './outbox-admin.service';
import { OutboxAdminController } from './outbox-admin.controller';

@Module({
  imports: [DatabaseModule, OrderExpirationModule, KafkaModule],
  controllers: [OutboxAdminController],
  providers: [OutboxDispatcherService, OutboxAdminService],
})
export class OutboxModule {}
