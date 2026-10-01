import { Controller } from '@nestjs/common';

import {
  Ctx,
  EventPattern,
  KafkaContext,
  Payload,
} from '@nestjs/microservices';

import {
  context as otelContext,
  SpanKind,
  SpanStatusCode,
  trace,
} from '@opentelemetry/api';

import { type OrderPaidEvent } from '../contracts/order-paid.event';

import {
  extractTraceContext,
  kafkaHeadersToCarrier,
} from '../telemetry/trace-context';

import { TicketingService } from './ticketing.service';

@Controller()
export class OrderPaidConsumer {
  constructor(private readonly ticketingService: TicketingService) {}

  @EventPattern('order.paid')
  async handleOrderPaid(
    @Payload()
    event: OrderPaidEvent,

    @Ctx()
    kafkaContext: KafkaContext,
  ): Promise<void> {
    const headers = kafkaHeadersToCarrier(kafkaContext.getMessage().headers);

    /*
     * Extract the W3C traceparent
     * produced by the API/outbox
     * process.
     */
    const parentContext = extractTraceContext(headers);

    await otelContext.with(
      parentContext,

      async () => {
        const tracer = trace.getTracer('seatlock-ticket-service');

        await tracer.startActiveSpan(
          'kafka.consume order.paid',

          {
            kind: SpanKind.CONSUMER,
          },

          async (span) => {
            try {
              await this.ticketingService.handleOrderPaid(event);

              span.setStatus({
                code: SpanStatusCode.OK,
              });
            } catch (error: unknown) {
              if (error instanceof Error) {
                span.recordException(error);
              }

              span.setStatus({
                code: SpanStatusCode.ERROR,
              });

              throw error;
            } finally {
              span.end();
            }
          },
        );
      },
    );
  }
}
