import { Injectable } from '@nestjs/common';
import { OrderPaidEvent } from '../contracts/order-paid.event';
import { TicketingDatabaseService } from './ticketing-database.service';

@Injectable()
export class TicketingService {
  constructor(private readonly database: TicketingDatabaseService) {}

  async handleOrderPaid(event: OrderPaidEvent): Promise<void> {
    await this.database.$transaction(async (tx) => {
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
