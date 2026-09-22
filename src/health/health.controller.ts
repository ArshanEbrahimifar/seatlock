import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';

import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('live')
  liveness() {
    return {
      status: 'ok',
    };
  }

  @Get('ready')
  async readiness() {
    const result = await this.healthService.checkReadiness();

    if (!result.ready) {
      throw new ServiceUnavailableException(result);
    }

    return result;
  }
}
