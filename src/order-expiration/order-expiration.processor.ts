import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';

import { DatabaseService } from '../database/database.service';

@Injectable()
@Processor('order-expiration')
export class OrderExpirationProcessor extends WorkerHost {
  constructor(private readonly database: DatabaseService) {
    super();
  }

  async process(job: Job<{ orderId: string }>) {
    if (job.name !== 'expire-order') {
      return;
    }

    const { orderId } = job.data;
    const now = new Date();

    await this.database.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: {
          id: orderId,
        },
        select: {
          id: true,
          eventSeatId: true,
        },
      });

      if (!order) {
        return;
      }

      const orderResult = await tx.order.updateMany({
        where: {
          id: orderId,
          status: 'PENDING',
          expiresAt: {
            lte: now,
          },
        },
        data: {
          status: 'CANCELLED',
        },
      });

      if (orderResult.count === 0) {
        return;
      }

      const seatResult = await tx.eventSeat.updateMany({
        where: {
          id: order.eventSeatId,
          status: 'RESERVED',
        },
        data: {
          status: 'AVAILABLE',
        },
      });

      if (seatResult.count === 0) {
        throw new Error('Reserved seat could not be released');
      }
    });
  }
}
