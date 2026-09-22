import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { Admin, Kafka } from 'kafkajs';

import { DatabaseService } from '../database/database.service';

@Injectable()
export class HealthService implements OnModuleDestroy {
  private readonly redis: Redis;
  private readonly kafkaAdmin: Admin;

  constructor(
    private readonly database: DatabaseService,
    private readonly configService: ConfigService,
  ) {
    this.redis = new Redis({
      host: this.configService.getOrThrow<string>('REDIS_HOST'),
      port: this.configService.getOrThrow<number>('REDIS_PORT'),
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });

    const kafka = new Kafka({
      clientId: 'seatlock-health',
      brokers: this.configService
        .getOrThrow<string>('KAFKA_BROKERS')
        .split(',')
        .map((broker) => broker.trim()),
    });

    this.kafkaAdmin = kafka.admin();
  }

  async onModuleDestroy() {
    await Promise.allSettled([this.redis.quit(), this.kafkaAdmin.disconnect()]);
  }

  async checkReadiness() {
    const [database, redis, kafka] = await Promise.allSettled([
      this.withTimeout(
        this.checkDatabase(),
        2000,
        'Database health check timed out',
      ),

      this.withTimeout(this.checkRedis(), 2000, 'Redis health check timed out'),

      this.withTimeout(this.checkKafka(), 3000, 'Kafka health check timed out'),
    ]);

    const services = {
      database: database.status === 'fulfilled',
      redis: redis.status === 'fulfilled',
      kafka: kafka.status === 'fulfilled',
    };

    return {
      ready: services.database && services.redis && services.kafka,

      services,
    };
  }

  private async checkDatabase() {
    await this.database.$queryRaw`SELECT 1`;
  }

  private async checkRedis() {
    if (this.redis.status === 'wait') {
      await this.redis.connect();
    }

    const result = await this.redis.ping();

    if (result !== 'PONG') {
      throw new Error('Redis ping failed');
    }
  }

  private async checkKafka() {
    await this.kafkaAdmin.connect();

    await this.kafkaAdmin.listTopics();
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    message: string,
  ): Promise<T> {
    let timeout: NodeJS.Timeout | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        reject(new Error(message));
      }, timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }
}
