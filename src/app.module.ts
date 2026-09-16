import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { ConfigModule } from '@nestjs/config';
import { envSchema } from './config/env.Schema';

@Module({
  imports: [
    DatabaseModule,
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: (config) => envSchema.parse(config),
    }),
  ],
})
export class AppModule {}
