import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateSeatDto } from './dto/create-seat.dto';

@Injectable()
@Injectable()
export class SeatsService {
  constructor(private readonly database: DatabaseService) {}

  async create(dto: CreateSeatDto, venueId: string) {
    const venue = await this.database.venue.findUnique({
      where: {
        id: venueId,
      },
      select: {
        id: true,
      },
    });

    if (!venue) {
      throw new NotFoundException('Venue not found');
    }

    return this.database.seat.create({
      data: {
        section: dto.section,
        row: dto.row,
        number: dto.number,
        venueId,
      },
    });
  }

  async findAll(venueId: string) {
    const venue = await this.database.venue.findUnique({
      where: {
        id: venueId,
      },
      select: {
        id: true,
      },
    });

    if (!venue) {
      throw new NotFoundException('Venue not found');
    }

    return this.database.seat.findMany({
      where: {
        venueId,
      },
      orderBy: [{ section: 'asc' }, { row: 'asc' }, { number: 'asc' }],
    });
  }
}
