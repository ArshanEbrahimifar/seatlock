import { Module } from '@nestjs/common';
import { SeatUpdatesGateway } from './seat-updates.gateway';

@Module({
  providers: [SeatUpdatesGateway],
  exports: [SeatUpdatesGateway],
})
export class RealtimeModule {}
