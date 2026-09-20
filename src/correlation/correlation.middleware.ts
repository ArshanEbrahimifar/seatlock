import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';

import { CorrelationService } from './correlation.service';

@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  constructor(private readonly correlationService: CorrelationService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const header = req.header('x-correlation-id');

    const correlationId = header?.trim() || randomUUID();

    res.setHeader('x-correlation-id', correlationId);

    this.correlationService.run(correlationId, () => next());
  }
}
