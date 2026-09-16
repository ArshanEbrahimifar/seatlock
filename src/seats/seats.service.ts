import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateSeatDto } from './dto/create-seat.dto';
import { Prisma } from '../../generated/prisma/client';

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

    try {
      return await this.database.seat.create({
        data: {
          section: dto.section,
          row: dto.row,
          number: dto.number,
          venueId,
        },
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Seat already exists');
      }
      throw error;
    }
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
