import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { DatabaseService } from '../database/database.service';
import { JoinEventDto } from './dto/join-event.dto';
import { UsePipes, ValidationPipe } from '@nestjs/common';

@WebSocketGateway({
  namespace: '/seats',
  cors: {
    origin: '*',
  },
})
export class SeatUpdatesGateway {
  private readonly maxRoomsPerClient = 10;

  constructor(private readonly database: DatabaseService) {}

  @WebSocketServer()
  server!: Server;

  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  )
  @SubscribeMessage('join-event')
  async joinEvent(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: JoinEventDto,
  ) {
    const room = `event:${body.eventId}`;

    if (client.rooms.has(room)) {
      return {
        event: 'joined-event',
        data: {
          eventId: body.eventId,
        },
      };
    }
    const joinedEventRooms = [...client.rooms].filter((room) =>
      room.startsWith('event:'),
    );

    if (joinedEventRooms.length >= this.maxRoomsPerClient) {
      throw new WsException('Maximum event subscriptions reached');
    }

    const event = await this.database.event.findUnique({
      where: {
        id: body.eventId,
      },
      select: {
        id: true,
      },
    });

    if (!event) {
      throw new WsException('Event not found');
    }

    await client.join(room);

    return {
      event: 'joined-event',
      data: {
        eventId: body.eventId,
      },
    };
  }

  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  )
  @SubscribeMessage('leave-event')
  async leaveEvent(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: JoinEventDto,
  ) {
    const room = `event:${body.eventId}`;

    if (!client.rooms.has(room)) {
      return {
        event: 'left-event',
        data: {
          eventId: body.eventId,
        },
      };
    }

    await client.leave(room);

    return {
      event: 'left-event',
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
