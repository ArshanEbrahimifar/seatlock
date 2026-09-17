import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';

import { DatabaseService } from '../database/database.service';
import { CreateEventSeatDto } from './dto/create-event-seat.dto';

@Injectable()
export class EventSeatsService {
  constructor(private readonly database: DatabaseService) {}

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
}
