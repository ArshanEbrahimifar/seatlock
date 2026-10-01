import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';

import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { Request, Response } from 'express';

import { MetricsService } from './metrics.service';

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();

    const response = context.switchToHttp().getResponse<Response>();

    if (request.path === '/metrics') {
      return next.handle();
    }

    const startedAt = process.hrtime.bigint();

    const controller = context.getClass().name;

    const handler = context.getHandler().name;

    return next.handle().pipe(
      finalize(() => {
        const finishedAt = process.hrtime.bigint();

        const durationSeconds = Number(finishedAt - startedAt) / 1_000_000_000;

        this.metricsService.observeHttpRequest({
          method: request.method,
          controller,
          handler,
          statusCode: response.statusCode,
          durationSeconds,
        });
      }),
    );
  }
}
