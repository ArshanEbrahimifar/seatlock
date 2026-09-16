import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateEventDto } from './dto/create-event.dto';

@Injectable()
export class EventsService {
  constructor(private readonly database: DatabaseService) {}

  async create(dto: CreateEventDto, venueId: string) {
    const existingVenue = await this.database.venue.findUnique({
      where: {
        id: venueId,
      },
      select: {
        id: true,
      },
    });

    if (!existingVenue) {
      throw new NotFoundException('Venue not found');
    }

    return this.database.event.create({
      data: {
        name: dto.name,
        startsAt: new Date(dto.startsAt),
        venueId,
      },
    });
  }

  async findAll(venueId: string) {
    const existingVenue = await this.database.venue.findUnique({
      where: {
        id: venueId,
      },
      select: {
        id: true,
      },
    });

    if (!existingVenue) {
      throw new NotFoundException('Venue not found');
    }

    return this.database.event.findMany({
      where: {
        venueId,
      },
      orderBy: {
        startsAt: 'asc',
      },
    });
  }
}
