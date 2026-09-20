import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';
import { AppLoggerService } from '../logging/app-logger.service';

export type OrderPaidEvent = {
  correlationId: string;
  eventId: string;
  orderId: string;
  eventSeatId: string;
  amount: string;
  paidAt: string;
};

@Injectable()
export class OrderEventsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly logger: AppLoggerService,
  ) {}

  async handleOrderPaid(event: OrderPaidEvent) {
    return this.database.$transaction(async (tx) => {
      const claimed = await tx.inboxEvent.createMany({
        data: [
          {
            eventId: event.eventId,
            consumer: 'ticketing',
          },
        ],
        skipDuplicates: true,
      });

      if (claimed.count === 0) {
        this.logger.log('order.paid_duplicate_ignored', {
          eventId: event.eventId,
          orderId: event.orderId,
        });

        return;
      }

      await tx.ticket.create({
        data: {
          orderId: event.orderId,
          eventSeatId: event.eventSeatId,
          amount: event.amount,
        },
      });

      this.logger.log('ticket.issued', {
        eventId: event.eventId,
        orderId: event.orderId,
        eventSeatId: event.eventSeatId,
      });
    });
  }
}
