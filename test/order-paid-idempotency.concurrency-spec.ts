import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';

import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { randomUUID } from 'node:crypto';

import { DatabaseModule } from '../src/database/database.module';
import { DatabaseService } from '../src/database/database.service';
import {
  OrderEventsService,
  OrderPaidEvent,
} from '../src/order-events/order-events.service';
import { AppLoggerService } from '../src/logging/app-logger.service';

describe('ORDER_PAID consumer idempotency', () => {
  let database: DatabaseService;
  let orderEventsService: OrderEventsService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        DatabaseModule,
      ],

      providers: [
        OrderEventsService,

        {
          provide: AppLoggerService,
          useValue: {
            log: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
          },
        },
      ],
    }).compile();

    database = moduleRef.get(DatabaseService);
    orderEventsService = moduleRef.get(OrderEventsService);
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
      orderEventsService.handleOrderPaid(event),
      orderEventsService.handleOrderPaid(event),
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
