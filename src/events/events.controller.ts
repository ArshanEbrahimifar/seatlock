import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';

import { CreateEventDto } from './dto/create-event.dto';
import { EventsService } from './events.service';

@Controller('venues/:venueId/events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  create(
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
    @Body() dto: CreateEventDto,
  ) {
    return this.eventsService.create(dto, venueId);
  }

  @Get()
  findAll(@Param('venueId', new ParseUUIDPipe()) venueId: string) {
    return this.eventsService.findAll(venueId);
  }
}
