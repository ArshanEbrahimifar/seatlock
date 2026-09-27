import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  namespace: '/seats',
  cors: {
    origin: '*',
  },
})
export class SeatUpdatesGateway {
  @WebSocketServer()
  server!: Server;

  @SubscribeMessage('join-event')
  async joinEvent(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { eventId: string },
  ) {
    const room = `event:${body.eventId}`;

    await client.join(room);

    return {
      event: 'joined-event',
      data: {
        eventId: body.eventId,
      },
    };
  }

  emitSeatUpdated(data: {
    eventId: string;
    eventSeatId: string;
    status: string;
    holdExpiresAt?: Date | null;
  }) {
    this.server.to(`event:${data.eventId}`).emit('seat.updated', data);
  }
}
