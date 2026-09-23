import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';

import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';

import { DatabaseModule } from '../src/database/database.module';
import { DatabaseService } from '../src/database/database.service';
import { EventSeatsService } from '../src/event-seats/event-seats.service';
import { OrderExpirationService } from '../src/order-expiration/order-expiration.service';

describe('Seat hold concurrency', () => {
  let database: DatabaseService;
  let eventSeatsService: EventSeatsService;

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
        EventSeatsService,

        {
          provide: OrderExpirationService,
          useValue: {
            schedule: jest.fn(),
          },
        },
      ],
    }).compile();

    database = moduleRef.get(DatabaseService);
    eventSeatsService = moduleRef.get(EventSeatsService);
  });

  afterAll(async () => {
    await database.$disconnect();
  });

  it('allows only one concurrent hold for the same event seat', async () => {
    const venue = await database.venue.create({
      data: {
        name: `Concurrency Venue ${Date.now()}`,
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
        name: `Concurrency Event ${Date.now()}`,
        startsAt: new Date(Date.now() + 86_400_000),
      },
    });

    const eventSeat = await database.eventSeat.create({
      data: {
        eventId: event.id,
        seatId: seat.id,
        price: 100,
      },
    });

    const attempts = Array.from({ length: 20 }, () =>
      eventSeatsService.hold(eventSeat.id),
    );

    const results = await Promise.allSettled(attempts);

    const successful = results.filter(
      (result) => result.status === 'fulfilled',
    );

    const failed = results.filter((result) => result.status === 'rejected');

    expect(successful).toHaveLength(1);
    expect(failed).toHaveLength(19);

    const finalEventSeat = await database.eventSeat.findUniqueOrThrow({
      where: {
        id: eventSeat.id,
      },
    });

    expect(finalEventSeat.status).toBe('HELD');
    expect(finalEventSeat.holdToken).not.toBeNull();
    expect(finalEventSeat.holdExpiresAt).not.toBeNull();
  });
});
