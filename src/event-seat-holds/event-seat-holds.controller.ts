import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';

import { EventSeatsService } from '../event-seats/event-seats.service';
import { ReleaseHoldDto } from './dto/release-hold.dto';
import { BookSeatDto } from './dto/book-seat.dto';

@Controller('event-seats')
export class EventSeatHoldsController {
  constructor(private readonly eventSeatsService: EventSeatsService) {}

  @Post(':eventSeatId/hold')
  hold(
    @Param('eventSeatId', new ParseUUIDPipe())
    eventSeatId: string,
  ) {
    return this.eventSeatsService.hold(eventSeatId);
  }

  @Post(':eventSeatId/release')
  release(
    @Param('eventSeatId', new ParseUUIDPipe())
    eventSeatId: string,
    @Body() dto: ReleaseHoldDto,
  ) {
    return this.eventSeatsService.release(eventSeatId, dto.holdToken);
  }

  @Post(':eventSeatId/book')
  book(
    @Param('eventSeatId', new ParseUUIDPipe())
    eventSeatId: string,
    @Body() dto: BookSeatDto,
  ) {
    return this.eventSeatsService.book(eventSeatId, dto.holdToken);
  }
}
