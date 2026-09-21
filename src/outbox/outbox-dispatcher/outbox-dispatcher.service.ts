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

      const maxAttempts = this.configService.getOrThrow<number>(
        'OUTBOX_MAX_ATTEMPTS',
      );

      const retryBaseSeconds = this.configService.getOrThrow<number>(
        'OUTBOX_RETRY_BASE_SECONDS',
      );

      const retryMaxSeconds = this.configService.getOrThrow<number>(
        'OUTBOX_RETRY_MAX_SECONDS',
      );

      const lockExpiredBefore = new Date(now.getTime() - lockSeconds * 1000);

      const events = await this.database.outboxEvent.findMany({
        where: {
          processedAt: null,
          deadLetteredAt: null,

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
          AND: [
            {
              OR: [
                {
                  nextAttemptAt: null,
                },
                {
                  nextAttemptAt: {
                    lte: now,
                  },
                },
              ],
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
            deadLetteredAt: null,

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
              deadLetteredAt: null,
            },

            data: {
              processedAt: new Date(),
              nextAttemptAt: null,
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

          const nextAttempts = event.attempts + 1;

          const retryDelaySeconds = Math.min(
            retryBaseSeconds * 2 ** (nextAttempts - 1),
            retryMaxSeconds,
          );

          const nextAttemptAt = new Date(Date.now() + retryDelaySeconds * 1000);

          const shouldDeadLetter = nextAttempts >= maxAttempts;

          await this.database.outboxEvent.updateMany({
            where: {
              id: event.id,
              lockedBy: this.instanceId,
              processedAt: null,
              deadLetteredAt: null,
            },

            data: {
              attempts: nextAttempts,
              lastError: message,

              deadLetteredAt: shouldDeadLetter ? new Date() : null,
              nextAttemptAt: shouldDeadLetter ? null : nextAttemptAt,

              lockedAt: null,
              lockedBy: null,
            },
          });

          if (shouldDeadLetter) {
            this.logger.error('outbox.dead_lettered', {
              outboxEventId: event.id,
              type: event.type,
              attempts: nextAttempts,
              error: message,
            });

            continue;
          }

          this.logger.warn('outbox.retry_scheduled', {
            outboxEventId: event.id,
            type: event.type,
            attempts: nextAttempts,
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
