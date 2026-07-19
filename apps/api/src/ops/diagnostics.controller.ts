import { Controller, Get, Header } from '@nestjs/common';
import { CORE_WIRING_MATRIX } from '@tradeops/contracts';
import { CurrentAuth, RequirePermissions } from '../identity/decorators';
import type { AuthContext } from '../identity/types';
import { DiagnosticsService } from './diagnostics.service';

@Controller('ops')
export class DiagnosticsController {
  constructor(private readonly diagnostics: DiagnosticsService) {}

  /**
   * Stack diagnostics — configuration honesty board (no secrets).
   */
  @Get('diagnostics')
  @RequirePermissions('connectors:read', 'org:read')
  async diagnosticsReport(@CurrentAuth() auth: AuthContext) {
    return this.diagnostics.probeStack(auth.activeOrganizationId ?? undefined);
  }

  /**
   * Frontend↔backend wiring matrix (static catalog + status).
   */
  @Get('wiring-matrix')
  @RequirePermissions('connectors:read', 'org:read')
  wiringMatrix() {
    return {
      at: new Date().toISOString(),
      rows: CORE_WIRING_MATRIX,
      principle:
        'Every visible production action maps to a backend operation. Decorative controls are forbidden.',
    };
  }
}
