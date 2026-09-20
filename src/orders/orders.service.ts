import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CorrelationService } from '../correlation/correlation.service';
import { randomUUID } from 'node:crypto';
import { AppLoggerService } from '../logging/app-logger.service';

@Injectable()
export class OrdersService {
  constructor(
    private readonly database: DatabaseService,
    private readonly correlationService: CorrelationService,
    private readonly logger: AppLoggerService,
  ) {}

  async pay(orderId: string) {
    const now = new Date();

    const correlationId = this.correlationService.getId() ?? randomUUID();

    return this.database.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: {
          id: orderId,
        },
        select: {
          id: true,
          eventSeatId: true,
          amount: true,
          status: true,
          expiresAt: true,
        },
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      if (order.status === 'PAID') {
        throw new ConflictException('Order is already paid');
      }

      if (order.status === 'CANCELLED') {
        throw new ConflictException('Order is cancelled');
      }

      if (order.expiresAt <= now) {
        throw new ConflictException('Order has expired');
      }

      const orderResult = await tx.order.updateMany({
        where: {
          id: orderId,
          status: 'PENDING',
          expiresAt: {
            gt: now,
          },
        },
        data: {
          status: 'PAID',
        },
      });

      if (orderResult.count === 0) {
        throw new ConflictException('Order could not be paid');
      }

      const seatResult = await tx.eventSeat.updateMany({
        where: {
          id: order.eventSeatId,
          status: 'RESERVED',
        },
        data: {
          status: 'BOOKED',
        },
      });

      if (seatResult.count === 0) {
        throw new ConflictException('Reserved seat could not be booked');
      }

      await tx.outboxEvent.create({
        data: {
          type: 'ORDER_PAID',

          payload: {
            correlationId,
            orderId: order.id,
            eventSeatId: order.eventSeatId,
            amount: order.amount.toString(),
            paidAt: now.toISOString(),
          },
        },
      });

      const paidOrder = await tx.order.findUniqueOrThrow({
        where: {
          id: orderId,
        },
      });

      const bookedSeat = await tx.eventSeat.findUniqueOrThrow({
        where: {
          id: order.eventSeatId,
        },
      });

      this.logger.log('order.paid', {
        orderId,
        eventSeatId: order.eventSeatId,
      });

      return {
        order: paidOrder,
        eventSeat: bookedSeat,
      };
    });
  }

  async cancel(orderId: string) {
    return this.database.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: {
          id: orderId,
        },
        select: {
          id: true,
          eventSeatId: true,
          status: true,
        },
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      if (order.status === 'PAID') {
        throw new ConflictException('Paid order cannot be cancelled');
      }

      if (order.status === 'CANCELLED') {
        throw new ConflictException('Order is already cancelled');
      }

      const orderResult = await tx.order.updateMany({
        where: {
          id: orderId,
          status: 'PENDING',
        },
        data: {
          status: 'CANCELLED',
        },
      });

      if (orderResult.count === 0) {
        throw new ConflictException('Order could not be cancelled');
      }

      const seatResult = await tx.eventSeat.updateMany({
        where: {
          id: order.eventSeatId,
          status: 'RESERVED',
        },
        data: {
          status: 'AVAILABLE',
        },
      });

      if (seatResult.count === 0) {
        throw new ConflictException('Reserved seat could not be released');
      }

      return {
        order: await tx.order.findUniqueOrThrow({
          where: {
            id: orderId,
          },
        }),

        eventSeat: await tx.eventSeat.findUniqueOrThrow({
          where: {
            id: order.eventSeatId,
          },
        }),
      };
    });
  }

  async expire(orderId: string) {
    const now = new Date();

    return this.database.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: {
          id: orderId,
        },
        select: {
          id: true,
          eventSeatId: true,
          status: true,
          expiresAt: true,
        },
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      if (order.status !== 'PENDING') {
        throw new ConflictException('Order is not pending');
      }

      if (order.expiresAt > now) {
        throw new ConflictException('Order has not expired yet');
      }

      const orderResult = await tx.order.updateMany({
        where: {
          id: orderId,
          status: 'PENDING',
          expiresAt: {
            lte: now,
          },
        },
        data: {
          status: 'CANCELLED',
        },
      });

      if (orderResult.count === 0) {
        throw new ConflictException('Order could not be expired');
      }

      const seatResult = await tx.eventSeat.updateMany({
        where: {
          id: order.eventSeatId,
          status: 'RESERVED',
        },
        data: {
          status: 'AVAILABLE',
        },
      });

      if (seatResult.count === 0) {
        throw new ConflictException('Reserved seat could not be released');
      }

      return {
        order: await tx.order.findUniqueOrThrow({
          where: {
            id: orderId,
          },
        }),

        eventSeat: await tx.eventSeat.findUniqueOrThrow({
          where: {
            id: order.eventSeatId,
          },
        }),
      };
    });
  }
}
