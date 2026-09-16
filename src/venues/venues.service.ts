import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateVenueDto } from './dto/create-venue.dto';

@Injectable()
export class VenuesService {
  constructor(private readonly databaseService: DatabaseService) {}

  async create(dto: CreateVenueDto) {
    const existingVenue = await this.databaseService.venue.findFirst({
      where: {
        name: dto.name,
        city: dto.city,
      },
    });

    if (existingVenue) {
      throw new BadRequestException('Venue already exists');
    }

    return this.databaseService.venue.create({
      data: {
        name: dto.name,
        city: dto.city,
      },
      select: {
        id: true,
        name: true,
        city: true,
        createdAt: true,
      },
    });
  }

  findAll() {
    return this.databaseService.venue.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        name: true,
        city: true,
        createdAt: true,
      },
    });
  }
}
