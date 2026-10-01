import { Injectable } from '@nestjs/common';
import {
  collectDefaultMetrics,
  Histogram,
  Registry,
  Counter,
} from 'prom-client';

@Injectable()
export class MetricsService {
  readonly registry = new Registry();

  private readonly httpRequestDuration: Histogram<string>;
  private readonly seatHoldTotal: Counter<string>;
  private readonly paymentTotal: Counter<string>;
  private readonly outboxRetryTotal: Counter<string>;
  private readonly outboxDeadLetterTotal: Counter<string>;

  constructor() {
    collectDefaultMetrics({
      register: this.registry,
      prefix: 'seatlock_',
    });

    this.httpRequestDuration = new Histogram({
      name: 'seatlock_http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'controller', 'handler', 'status_code'],
      registers: [this.registry],
    });

    this.seatHoldTotal = new Counter({
      name: 'seatlock_seat_hold_total',
      help: 'Total number of seat hold attempts',
      labelNames: ['result'],
      registers: [this.registry],
    });

    this.paymentTotal = new Counter({
      name: 'seatlock_payment_total',
      help: 'Total number of payment attempts',
      labelNames: ['result'],
      registers: [this.registry],
    });

    this.outboxRetryTotal = new Counter({
      name: 'seatlock_outbox_retry_total',
      help: 'Total number of outbox delivery retries',
      labelNames: ['type'],
      registers: [this.registry],
    });

    this.outboxDeadLetterTotal = new Counter({
      name: 'seatlock_outbox_dead_letter_total',
      help: 'Total number of outbox events moved to dead letter',
      labelNames: ['type'],
      registers: [this.registry],
    });
  }

  observeHttpRequest(data: {
    method: string;
    controller: string;
    handler: string;
    statusCode: number;
    durationSeconds: number;
  }): void {
    this.httpRequestDuration.observe(
      {
        method: data.method,
        controller: data.controller,
        handler: data.handler,
        status_code: data.statusCode.toString(),
      },
      data.durationSeconds,
    );
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  get contentType(): string {
    return this.registry.contentType;
  }

  recordSeatHold(result: 'success' | 'conflict'): void {
    this.seatHoldTotal.inc({
      result,
    });
  }

  recordPayment(result: 'success' | 'failed'): void {
    this.paymentTotal.inc({
      result,
    });
  }

  recordOutboxRetry(type: string): void {
    this.outboxRetryTotal.inc({
      type,
    });
  }

  recordOutboxDeadLetter(type: string): void {
    this.outboxDeadLetterTotal.inc({
      type,
    });
  }
}
