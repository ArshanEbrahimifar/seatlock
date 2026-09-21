import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';

import { DatabaseService } from '../../database/database.service';
import { KafkaProducerService } from '../../kafka/kafka-producer/kafka-producer.service';
import { AppLoggerService } from '../../logging/app-logger.service';
import { OrderExpirationService } from '../../order-expiration/order-expiration.service';
import { CorrelationService } from '../../correlation/correlation.service';

@Injectable()
export class OutboxDispatcherService {
  private running = false;

  private readonly instanceId = `${hostname()}-${process.pid}-${randomUUID()}`;

  constructor(
    private readonly database: DatabaseService,
    private readonly configService: ConfigService,
    private readonly orderExpirationService: OrderExpirationService,
    private readonly kafkaProducerService: KafkaProducerService,
    private readonly logger: AppLoggerService,
    private readonly correlationService: CorrelationService,
  ) {}

  @Interval(5000)
  async dispatch() {
    if (this.running) {
      return;
    }

    this.running = true;

    try {
      const now = new Date();

      const lockSeconds = this.configService.getOrThrow<number>(
        'OUTBOX_LOCK_SECONDS',
      );

      const lockExpiredBefore = new Date(now.getTime() - lockSeconds * 1000);

      const events = await this.database.outboxEvent.findMany({
        where: {
          processedAt: null,

          OR: [
            {
              lockedAt: null,
            },
            {
              lockedAt: {
                lte: lockExpiredBefore,
              },
            },
          ],
        },

        orderBy: {
          createdAt: 'asc',
        },

        take: 50,
      });

      for (const event of events) {
        const claimed = await this.database.outboxEvent.updateMany({
          where: {
            id: event.id,
            processedAt: null,

            OR: [
              {
                lockedAt: null,
              },
              {
                lockedAt: {
                  lte: lockExpiredBefore,
                },
              },
            ],
          },

          data: {
            lockedAt: new Date(),
            lockedBy: this.instanceId,
          },
        });

        if (claimed.count === 0) {
          continue;
        }

        try {
          await this.processEvent(event);

          await this.database.outboxEvent.updateMany({
            where: {
              id: event.id,
              lockedBy: this.instanceId,
              processedAt: null,
            },

            data: {
              processedAt: new Date(),
              lockedAt: null,
              lockedBy: null,
              lastError: null,
            },
          });

          this.logger.log('outbox.published', {
            outboxEventId: event.id,
            type: event.type,
          });
        } catch (error: unknown) {
          const message =
            error instanceof Error ? error.message : 'Unknown error';

          await this.database.outboxEvent.updateMany({
            where: {
              id: event.id,
              lockedBy: this.instanceId,
              processedAt: null,
            },

            data: {
              attempts: {
                increment: 1,
              },

              lastError: message,

              lockedAt: null,
              lockedBy: null,
            },
          });

          this.logger.error('outbox.publish_failed', {
            outboxEventId: event.id,
            type: event.type,
            error: message,
          });
        }
      }
    } finally {
      this.running = false;
    }
  }

  private async processEvent(event: {
    id: string;
    type: 'ORDER_EXPIRATION' | 'ORDER_PAID';
    payload: unknown;
  }) {
    switch (event.type) {
      case 'ORDER_EXPIRATION': {
        const payload = event.payload as {
          orderId: string;
          expiresAt: string;
        };

        await this.orderExpirationService.schedule(
          payload.orderId,
          new Date(payload.expiresAt),
        );

        break;
      }

      case 'ORDER_PAID': {
        const payload = event.payload as {
          correlationId: string;
          orderId: string;
          eventSeatId: string;
          amount: string;
          paidAt: string;
        };

        await this.correlationService.run(payload.correlationId, async () => {
          await this.kafkaProducerService.publishOrderPaid({
            correlationId: payload.correlationId,
            eventId: event.id,
            orderId: payload.orderId,
            eventSeatId: payload.eventSeatId,
            amount: payload.amount,
            paidAt: payload.paidAt,
          });
        });

        break;
      }
    }
  }
}
