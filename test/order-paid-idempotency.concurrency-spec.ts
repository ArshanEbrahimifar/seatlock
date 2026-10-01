import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';

import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { randomUUID } from 'node:crypto';

import { TicketingDatabaseService } from '../src/ticket-service/ticketing-database.service';
import { TicketingService } from '../src/ticket-service/ticketing.service';
import { OrderPaidEvent } from '../src/contracts/order-paid.event';

describe('ORDER_PAID consumer idempotency', () => {
  let database: TicketingDatabaseService;
  let ticketingService: TicketingService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
      ],

      providers: [TicketingDatabaseService, TicketingService],
    }).compile();

    database = moduleRef.get(TicketingDatabaseService);
    ticketingService = moduleRef.get(TicketingService);
  });

  afterAll(async () => {
    await database.$disconnect();
  });

  it('issues only one ticket when the same event is delivered twice', async () => {
    const eventId = randomUUID();
    const orderId = randomUUID();
    const eventSeatId = randomUUID();

    const event: OrderPaidEvent = {
      correlationId: 'test-correlation-id',
      eventId,
      orderId,
      eventSeatId,
      amount: '100.00',
      paidAt: new Date().toISOString(),
    };

    const results = await Promise.allSettled([
      ticketingService.handleOrderPaid(event),
      ticketingService.handleOrderPaid(event),
    ]);

    const rejected = results.filter((result) => result.status === 'rejected');

    expect(rejected).toHaveLength(0);

    const inboxEvents = await database.inboxEvent.findMany({
      where: {
        eventId,
        consumer: 'ticketing',
      },
    });

    expect(inboxEvents).toHaveLength(1);

    const tickets = await database.ticket.findMany({
      where: {
        orderId,
      },
    });

    expect(tickets).toHaveLength(1);

    expect(tickets[0]?.eventSeatId).toBe(eventSeatId);
    expect(tickets[0]?.amount.toString()).toBe('100');
  });
});
