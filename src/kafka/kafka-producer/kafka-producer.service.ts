import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import { ClientKafka } from '@nestjs/microservices';

import { lastValueFrom } from 'rxjs';

import { type OrderPaidEvent } from '../../contracts/order-paid.event';

import { type TraceCarrier } from '../../telemetry/trace-context';

@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  constructor(
    @Inject('KAFKA_CLIENT')
    private readonly client: ClientKafka,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.client.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.close();
  }

  async publishOrderPaid(
    payload: OrderPaidEvent,
    headers: TraceCarrier = {},
  ): Promise<void> {
    await lastValueFrom(
      this.client.emit('order.paid', {
        key: payload.orderId,

        headers,

        value: payload,
      }),
    );
  }
}
