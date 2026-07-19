import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@tradeops/contracts';
import { architecturePublicStatus } from '@tradeops/domain';
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

  /**
   * Environment / provider configuration matrix (no secrets).
   * Statuses: configured | missing | disabled | optional_unconfigured | healthy | unhealthy.
   */
  @Public()
  @Get('environment')
  getEnvironmentHealth() {
    return this.healthService.getEnvironmentHealth();
  }

  /**
   * Canonical Commerce OS architecture registry (no secrets).
   * Layers, modules, data fabric entities, event catalog, ops command center.
   */
  @Public()
  @Get('architecture')
  getArchitecture() {
    return architecturePublicStatus();
  }
}
