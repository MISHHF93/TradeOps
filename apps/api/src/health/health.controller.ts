import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@tradeops/contracts';
import { Public } from '../identity/decorators';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /** Full dependency health for operators and load balancers that need readiness. */
  @Public()
  @Get()
  async getHealth(): Promise<HealthResponse> {
    return this.healthService.getHealth();
  }

  /** Process liveness — does not fail when dependencies are down. */
  @Public()
  @Get('live')
  getLiveness(): { status: 'up'; service: string } {
    return this.healthService.getLiveness();
  }
}
