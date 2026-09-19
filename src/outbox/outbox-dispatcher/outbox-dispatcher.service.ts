import { Injectable } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { DatabaseService } from '../../database/database.service';
import { OrderExpirationService } from '../../order-expiration/order-expiration.service';
import { KafkaProducerService } from '../../kafka/kafka-producer/kafka-producer.service';

@Injectable()
export class OutboxDispatcherService {
  private running = false;

  constructor(
    private readonly database: DatabaseService,
    private readonly orderExpirationService: OrderExpirationService,
    private readonly kafkaProducerService: KafkaProducerService,
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
                orderId: string;
                eventSeatId: string;
                amount: string;
                paidAt: string;
              };

              await this.kafkaProducerService.publishOrderPaid({
                eventId: event.id,
                orderId: payload.orderId,
                eventSeatId: payload.eventSeatId,
                amount: payload.amount,
                paidAt: payload.paidAt,
              });

              break;
            }
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
