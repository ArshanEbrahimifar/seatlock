import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../../generated/ticketing-prisma/client';

@Injectable()
export class TicketingDatabaseService
  extends PrismaClient
  implements OnModuleDestroy
{
  constructor(configService: ConfigService) {
    const connectionString = configService.getOrThrow<string>(
      'TICKETING_DATABASE_URL',
    );

    const adapter = new PrismaPg({
      connectionString,
    });

    super({
      adapter,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
