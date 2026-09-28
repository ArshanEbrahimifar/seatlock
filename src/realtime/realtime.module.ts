import { Module } from '@nestjs/common';
import { SeatUpdatesGateway } from './seat-updates.gateway';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [SeatUpdatesGateway],
  exports: [SeatUpdatesGateway],
})
export class RealtimeModule {}
