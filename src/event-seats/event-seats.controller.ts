import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';

import { CreateEventSeatDto } from './dto/create-event-seat.dto';
import { EventSeatsService } from './event-seats.service';

@Controller('events/:eventId/seats')
export class EventSeatsController {
  constructor(private readonly eventSeatsService: EventSeatsService) {}

  @Post()
  create(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Body() dto: CreateEventSeatDto,
  ) {
    return this.eventSeatsService.create(dto, eventId);
  }

  @Get()
  findAll(@Param('eventId', new ParseUUIDPipe()) eventId: string) {
    return this.eventSeatsService.findAll(eventId);
  }
}
