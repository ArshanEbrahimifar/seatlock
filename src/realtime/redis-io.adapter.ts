import { INestApplicationContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { Server, ServerOptions } from 'socket.io';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor?: ReturnType<typeof createAdapter>;

  private pubClient?: Redis;
  private subClient?: Redis;

  constructor(
    app: INestApplicationContext,
    private readonly configService: ConfigService,
  ) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    const redisHost = this.configService.getOrThrow<string>('REDIS_HOST');

    const redisPort = this.configService.getOrThrow<number>('REDIS_PORT');

    this.pubClient = new Redis({
      host: redisHost,
      port: redisPort,
      lazyConnect: true,
    });

    this.subClient = this.pubClient.duplicate();

    await Promise.all([this.pubClient.connect(), this.subClient.connect()]);

    this.adapterConstructor = createAdapter(this.pubClient, this.subClient);
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, options) as Server;

    if (!this.adapterConstructor) {
      throw new Error('Redis Socket.IO adapter has not been initialized');
    }

    server.adapter(this.adapterConstructor);

    return server;
  }

  async close(server: Server): Promise<void> {
    await super.close(server);

    await Promise.allSettled([this.pubClient?.quit(), this.subClient?.quit()]);
  }
}
