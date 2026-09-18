import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class OrderExpirationService {
  constructor(
    @InjectQueue('order-expiration')
    private readonly queue: Queue,
  ) {}

  async schedule(orderId: string, expiresAt: Date) {
    const delay = Math.max(expiresAt.getTime() - Date.now(), 0);

    await this.queue.add(
      'expire-order',
      {
        orderId,
      },
      {
        delay,
        jobId: `expire-order-${orderId}`,
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  }
}
