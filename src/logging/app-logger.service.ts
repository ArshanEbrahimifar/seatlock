import { Injectable, Logger } from '@nestjs/common';

import { CorrelationService } from '../correlation/correlation.service';

@Injectable()
export class AppLoggerService {
  private readonly logger = new Logger('SeatLock');

  constructor(private readonly correlationService: CorrelationService) {}

  log(event: string, data: Record<string, unknown> = {}) {
    this.logger.log(
      JSON.stringify({
        level: 'info',
        event,
        correlationId: this.correlationService.getId() ?? null,
        ...data,
      }),
    );
  }

  warn(event: string, data: Record<string, unknown> = {}) {
    this.logger.warn(
      JSON.stringify({
        level: 'warn',
        event,
        correlationId: this.correlationService.getId() ?? null,
        ...data,
      }),
    );
  }

  error(event: string, data: Record<string, unknown> = {}) {
    this.logger.error(
      JSON.stringify({
        level: 'error',
        event,
        correlationId: this.correlationService.getId() ?? null,
        ...data,
      }),
    );
  }
}
