import { Injectable } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { DatabaseService } from '../../database/database.service';
import { OrderExpirationService } from '../../order-expiration/order-expiration.service';

@Injectable()
export class OutboxDispatcherService {
  private running = false;

  constructor(
    private readonly database: DatabaseService,
    private readonly orderExpirationService: OrderExpirationService,
  ) {}

  @Interval(5000)
  async dispatch() {
    if (this.running) {
      return;
    }

    this.running = true;

    try {
      const events = await this.database.outboxEvent.findMany({
        where: {
          processedAt: null,
        },
        orderBy: {
          createdAt: 'asc',
        },
        take: 50,
      });

      for (const event of events) {
        try {
          if (event.type === 'ORDER_EXPIRATION') {
            const payload = event.payload as {
              orderId: string;
              expiresAt: string;
            };

            await this.orderExpirationService.schedule(
              payload.orderId,
              new Date(payload.expiresAt),
            );
          }

          await this.database.outboxEvent.update({
            where: {
              id: event.id,
            },
            data: {
              processedAt: new Date(),
            },
          });
        } catch (error) {
          await this.database.outboxEvent.update({
            where: {
              id: event.id,
            },
            data: {
              attempts: {
                increment: 1,
              },
              lastError:
                error instanceof Error ? error.message : 'Unknown error',
            },
          });
        }
      }
    } finally {
      this.running = false;
    }
  }
}
