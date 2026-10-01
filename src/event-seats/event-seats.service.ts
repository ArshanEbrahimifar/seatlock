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
import { OrderExpirationService } from '../order-expiration/order-expiration.service';
import { SeatUpdatesGateway } from '../realtime/seat-updates.gateway';
import { MetricsService } from '../metrics/metrics.service';
@Injectable()
export class EventSeatsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly configService: ConfigService,
    private readonly orderExpirationService: OrderExpirationService,
    private readonly seatUpdatesGateway: SeatUpdatesGateway,
    private readonly metricsService: MetricsService,
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
      this.metricsService.recordSeatHold('conflict');
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

      if (eventSeat.status === 'RESERVED') {
        throw new ConflictException('Seat is already reserved');
      }

      throw new ConflictException('Seat is currently held');
    }
    this.metricsService.recordSeatHold('success');
    const updatedSeat = await this.database.eventSeat.findUniqueOrThrow({
      where: {
        id: eventSeatId,
      },
      select: {
        id: true,
        eventId: true,
        status: true,
        holdToken: true,
        holdExpiresAt: true,
      },
    });

    this.seatUpdatesGateway.emitSeatUpdated({
      eventId: updatedSeat.eventId,
      eventSeatId: updatedSeat.id,
      status: updatedSeat.status,
      holdExpiresAt: updatedSeat.holdExpiresAt,
    });

    return updatedSeat;
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

    const updatedSeat = await this.database.eventSeat.findUniqueOrThrow({
      where: {
        id: eventSeatId,
      },
      select: {
        id: true,
        eventId: true,
        status: true,
        holdExpiresAt: true,
      },
    });

    this.seatUpdatesGateway.emitSeatUpdated({
      eventId: updatedSeat.eventId,
      eventSeatId: updatedSeat.id,
      status: updatedSeat.status,
      holdExpiresAt: updatedSeat.holdExpiresAt,
    });

    return updatedSeat;
  }

  async reserve(eventSeatId: string, holdToken: string) {
    const now = new Date();

    const paymentWindowSeconds = this.configService.getOrThrow<number>(
      'PAYMENT_WINDOW_SECONDS',
    );

    const orderExpiresAt = new Date(
      now.getTime() + paymentWindowSeconds * 1000,
    );

    const result = await this.database.$transaction(async (tx) => {
      const seatResult = await tx.eventSeat.updateMany({
        where: {
          id: eventSeatId,
          status: 'HELD',
          holdToken,
          holdExpiresAt: {
            gt: now,
          },
        },
        data: {
          status: 'RESERVED',
          holdToken: null,
          holdExpiresAt: null,
        },
      });

      if (seatResult.count === 0) {
        const eventSeat = await tx.eventSeat.findUnique({
          where: {
            id: eventSeatId,
          },
          select: {
            status: true,
            holdToken: true,
            holdExpiresAt: true,
          },
        });

        if (!eventSeat) {
          throw new NotFoundException('Event seat not found');
        }

        if (eventSeat.status === 'BOOKED') {
          throw new ConflictException('Seat is already booked');
        }

        if (eventSeat.status === 'RESERVED') {
          throw new ConflictException('Seat is already reserved');
        }

        if (eventSeat.status !== 'HELD') {
          throw new ConflictException('Seat is not currently held');
        }

        if (eventSeat.holdToken !== holdToken) {
          throw new ConflictException('Invalid hold token');
        }

        if (!eventSeat.holdExpiresAt || eventSeat.holdExpiresAt <= now) {
          throw new ConflictException('Seat hold has expired');
        }

        throw new ConflictException('Seat could not be reserved');
      }

      const eventSeat = await tx.eventSeat.findUniqueOrThrow({
        where: {
          id: eventSeatId,
        },
        select: {
          id: true,
          price: true,
          eventId: true,
          holdExpiresAt: true,
        },
      });

      const order = await tx.order.create({
        data: {
          eventSeatId,
          amount: eventSeat.price,
          expiresAt: orderExpiresAt,
        },
      });

      await tx.outboxEvent.create({
        data: {
          type: 'ORDER_EXPIRATION',
          payload: {
            orderId: order.id,
            expiresAt: order.expiresAt.toISOString(),
          },
        },
      });

      return {
        order,
        eventSeat: {
          id: eventSeat.id,
          status: 'RESERVED' as const,
          eventId: eventSeat.eventId,
          holdExpiresAt: eventSeat.holdExpiresAt,
        },
      };
    });

    this.seatUpdatesGateway.emitSeatUpdated({
      eventId: result.eventSeat.eventId,
      eventSeatId: result.eventSeat.id,
      status: result.eventSeat.status,
      holdExpiresAt: result.eventSeat.holdExpiresAt,
    });

    return result;
  }
}
