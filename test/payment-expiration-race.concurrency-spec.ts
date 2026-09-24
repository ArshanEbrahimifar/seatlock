import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';

import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';

import { DatabaseModule } from '../src/database/database.module';
import { DatabaseService } from '../src/database/database.service';
import { OrdersService } from '../src/orders/orders.service';
import { CorrelationService } from '../src/correlation/correlation.service';
import { AppLoggerService } from '../src/logging/app-logger.service';

describe('Payment vs expiration concurrency', () => {
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
            getId: jest.fn(() => 'test-correlation-id'),
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

  it('keeps order and seat state consistent during payment/expiration race', async () => {
    const venue = await database.venue.create({
      data: {
        name: `Race Venue ${Date.now()}`,
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
        name: `Race Event ${Date.now()}`,
        startsAt: new Date(Date.now() + 86_400_000),
      },
    });

    const eventSeat = await database.eventSeat.create({
      data: {
        eventId: event.id,
        seatId: seat.id,
        price: 100,
        status: 'RESERVED',
      },
    });

    const order = await database.order.create({
      data: {
        eventSeatId: eventSeat.id,
        amount: 100,

        expiresAt: new Date(Date.now() + 50),
      },
    });

    const payPromise = ordersService.pay(order.id);

    const expirePromise = new Promise((resolve) =>
      setTimeout(resolve, 60),
    ).then(() => ordersService.expire(order.id));

    await Promise.allSettled([payPromise, expirePromise]);

    const finalOrder = await database.order.findUniqueOrThrow({
      where: {
        id: order.id,
      },
    });

    const finalSeat = await database.eventSeat.findUniqueOrThrow({
      where: {
        id: eventSeat.id,
      },
    });

    const paidCorrectly =
      finalOrder.status === 'PAID' && finalSeat.status === 'BOOKED';

    const expiredCorrectly =
      finalOrder.status === 'CANCELLED' && finalSeat.status === 'AVAILABLE';

    expect(paidCorrectly || expiredCorrectly).toBe(true);
  });
});
