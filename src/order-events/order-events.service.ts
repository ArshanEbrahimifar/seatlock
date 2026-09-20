import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';

export type OrderPaidEvent = {
  eventId: string;
  orderId: string;
  eventSeatId: string;
  amount: string;
  paidAt: string;
};

@Injectable()
export class OrderEventsService {
  constructor(private readonly database: DatabaseService) {}

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
        return;
      }

      await tx.ticket.create({
        data: {
          orderId: event.orderId,
          eventSeatId: event.eventSeatId,
          amount: event.amount,
        },
      });
    });
  }
}
