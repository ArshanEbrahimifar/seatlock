import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';

import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';

import { CorrelationService } from '../src/correlation/correlation.service';
import { DatabaseModule } from '../src/database/database.module';
import { DatabaseService } from '../src/database/database.service';
import { AppLoggerService } from '../src/logging/app-logger.service';
import { OrdersService } from '../src/orders/orders.service';

describe('Payment transaction rollback', () => {
  let database: DatabaseService;
  let ordersService: OrdersService;

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
        OrdersService,

        {
          provide: CorrelationService,
          useValue: {
            getId: jest.fn(() => 'rollback-test'),
          },
        },

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
    ordersService = moduleRef.get(OrdersService);
  });

  afterAll(async () => {
    await database.$disconnect();
  });

  it('rolls back order payment when seat booking fails', async () => {
    const venue = await database.venue.create({
      data: {
        name: `Rollback Venue ${Date.now()}`,
        city: 'Istanbul',
      },
    });

    const seat = await database.seat.create({
      data: {
        venueId: venue.id,
        section: 'VIP',
        row: 'A',
        number: 1,
      },
    });

    const event = await database.event.create({
      data: {
        venueId: venue.id,
        name: `Rollback Event ${Date.now()}`,
        startsAt: new Date(Date.now() + 86_400_000),
      },
    });

    const eventSeat = await database.eventSeat.create({
      data: {
        eventId: event.id,
        seatId: seat.id,
        price: 100,

        status: 'AVAILABLE',
      },
    });

    const order = await database.order.create({
      data: {
        eventSeatId: eventSeat.id,
        amount: 100,
        status: 'PENDING',

        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    await expect(ordersService.pay(order.id)).rejects.toThrow(
      'Reserved seat could not be booked',
    );

    const finalOrder = await database.order.findUniqueOrThrow({
      where: {
        id: order.id,
      },
    });

    const finalEventSeat = await database.eventSeat.findUniqueOrThrow({
      where: {
        id: eventSeat.id,
      },
    });

    expect(finalOrder.status).toBe('PENDING');

    expect(finalEventSeat.status).toBe('AVAILABLE');

    const paidOutboxEvents = await database.outboxEvent.findMany({
      where: {
        type: 'ORDER_PAID',
      },
    });

    const eventForThisOrder = paidOutboxEvents.find((outbox) => {
      const payload = outbox.payload as {
        orderId?: string;
      };

      return payload.orderId === order.id;
    });

    expect(eventForThisOrder).toBeUndefined();
  });
});
