import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { SeatsService } from './seats.service';
import { CreateSeatDto } from './dto/create-seat.dto';

@Controller('venues/:venueId/seats')
export class SeatsController {
  constructor(private readonly seatsService: SeatsService) {}

  @Post()
  create(
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
    @Body() dto: CreateSeatDto,
  ) {
    return this.seatsService.create(dto, venueId);
  }

  @Get()
  findAll(@Param('venueId', new ParseUUIDPipe()) venueId: string) {
    return this.seatsService.findAll(venueId);
  }
}
