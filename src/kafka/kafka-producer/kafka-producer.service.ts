import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import { ClientKafka } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  constructor(
    @Inject('KAFKA_CLIENT')
    private readonly client: ClientKafka,
  ) {}

  async onModuleInit() {
    await this.client.connect();
  }

  async onModuleDestroy() {
    await this.client.close();
  }

  async publishOrderPaid(payload: {
    eventId: string;
    orderId: string;
    eventSeatId: string;
    amount: string;
    paidAt: string;
  }) {
    await lastValueFrom(this.client.emit('order.paid', payload));
  }
}
