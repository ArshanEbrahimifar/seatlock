import { Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';

import { OutboxAdminService } from './outbox-admin.service';

@Controller('internal/outbox')
export class OutboxAdminController {
  constructor(private readonly outboxAdminService: OutboxAdminService) {}

  @Post(':eventId/redrive')
  redrive(
    @Param('eventId', new ParseUUIDPipe())
    eventId: string,
  ) {
    return this.outboxAdminService.redrive(eventId);
  }
}
