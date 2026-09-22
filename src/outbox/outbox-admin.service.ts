import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { DatabaseService } from '../database/database.service';
import { AppLoggerService } from '../logging/app-logger.service';

@Injectable()
export class OutboxAdminService {
  constructor(
    private readonly database: DatabaseService,
    private readonly logger: AppLoggerService,
  ) {}

  async redrive(eventId: string) {
    const result = await this.database.outboxEvent.updateMany({
      where: {
        id: eventId,
        processedAt: null,
        deadLetteredAt: {
          not: null,
        },
      },

      data: {
        deadLetteredAt: null,
        attempts: 0,
        nextAttemptAt: null,

        lockedAt: null,
        lockedBy: null,

        lastError: null,

        redriveCount: {
          increment: 1,
        },
      },
    });

    if (result.count === 0) {
      const event = await this.database.outboxEvent.findUnique({
        where: {
          id: eventId,
        },
        select: {
          processedAt: true,
          deadLetteredAt: true,
        },
      });

      if (!event) {
        throw new NotFoundException('Outbox event not found');
      }

      if (event.processedAt) {
        throw new ConflictException('Processed event cannot be redriven');
      }

      throw new ConflictException('Event is not dead-lettered');
    }

    this.logger.log('outbox.redriven', {
      outboxEventId: eventId,
    });

    return this.database.outboxEvent.findUnique({
      where: {
        id: eventId,
      },
    });
  }
}
