import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';

import { DatabaseService } from '../database/database.service';
import { CreateEventSeatDto } from './dto/create-event-seat.dto';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
@Injectable()
export class EventSeatsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly configService: ConfigService,
  ) {}

  async create(dto: CreateEventSeatDto, eventId: string) {
    const [seat, event] = await Promise.all([
      this.database.seat.findUnique({
        where: {
          id: dto.seatId,
        },
        select: {
          id: true,
          venueId: true,
        },
      }),

      this.database.event.findUnique({
        where: {
          id: eventId,
        },
        select: {
          id: true,
          venueId: true,
        },
      }),
    ]);

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    if (!seat) {
      throw new NotFoundException('Seat not found');
    }

    if (seat.venueId !== event.venueId) {
      throw new BadRequestException('Seat does not belong to the event venue');
    }

    try {
      return await this.database.eventSeat.create({
        data: {
          eventId,
          seatId: dto.seatId,
          price: dto.price,
        },
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Seat already added to this event');
      }

      throw error;
    }
  }

  async findAll(eventId: string) {
    const event = await this.database.event.findUnique({
      where: {
        id: eventId,
      },
      select: {
        id: true,
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    return this.database.eventSeat.findMany({
      where: {
        eventId,
      },
      orderBy: [
        {
          seat: {
            section: 'asc',
          },
        },
        {
          seat: {
            row: 'asc',
          },
        },
        {
          seat: {
            number: 'asc',
          },
        },
      ],
      include: {
        seat: {
          select: {
            id: true,
            section: true,
            row: true,
            number: true,
          },
        },
      },
    });
  }

  async hold(eventSeatId: string) {
    const now = new Date();

    const holdSeconds =
      this.configService.getOrThrow<number>('SEAT_HOLD_SECONDS');

    const holdToken = randomUUID();

    const holdExpiresAt = new Date(now.getTime() + holdSeconds * 1000);

    const result = await this.database.eventSeat.updateMany({
      where: {
        id: eventSeatId,

        OR: [
          {
            status: 'AVAILABLE',
          },
          {
            status: 'HELD',
            holdExpiresAt: {
              lte: now,
            },
          },
        ],
      },

      data: {
        status: 'HELD',
        holdToken,
        holdExpiresAt,
      },
    });

    if (result.count === 0) {
      const eventSeat = await this.database.eventSeat.findUnique({
        where: {
          id: eventSeatId,
        },
        select: {
          status: true,
        },
      });

      if (!eventSeat) {
        throw new NotFoundException('Event seat not found');
      }

      if (eventSeat.status === 'BOOKED') {
        throw new ConflictException('Seat is already booked');
      }

      throw new ConflictException('Seat is currently held');
    }

    return this.database.eventSeat.findUnique({
      where: {
        id: eventSeatId,
      },
      select: {
        id: true,
        status: true,
        holdToken: true,
        holdExpiresAt: true,
      },
    });
  }

  async release(eventSeatId: string, holdToken: string) {
    const result = await this.database.eventSeat.updateMany({
      where: {
        id: eventSeatId,
        status: 'HELD',
        holdToken,
      },
      data: {
        status: 'AVAILABLE',
        holdToken: null,
        holdExpiresAt: null,
      },
    });

    if (result.count === 0) {
      const eventSeat = await this.database.eventSeat.findUnique({
        where: {
          id: eventSeatId,
        },
        select: {
          status: true,
          holdToken: true,
        },
      });

      if (!eventSeat) {
        throw new NotFoundException('Event seat not found');
      }

      if (eventSeat.status === 'BOOKED') {
        throw new ConflictException('Seat is already booked');
      }

      if (eventSeat.status !== 'HELD') {
        throw new ConflictException('Seat is not currently held');
      }

      throw new ConflictException('Invalid hold token');
    }

    return this.database.eventSeat.findUnique({
      where: {
        id: eventSeatId,
      },
      select: {
        id: true,
        status: true,
        holdToken: true,
        holdExpiresAt: true,
      },
    });
  }
}
