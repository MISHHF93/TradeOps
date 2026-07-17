import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { isAuthBypassEnabled } from '@tradeops/config';
import type { Request } from 'express';
import { IS_PUBLIC_KEY, PERMISSIONS_KEY } from './decorators';
import { FounderAccessService } from './founder-access.service';
import { SessionService } from './session.service';
import { TenantContextService } from './tenant-context.service';
import type { AuthContext } from './types';

type AuthedRequest = Request & { auth?: AuthContext; cookies?: Record<string, string> };

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
    private readonly founderAccess: FounderAccessService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const token = request.cookies?.[this.sessions.cookieName];
    const direct = isAuthBypassEnabled();

    // Prefer a real session cookie when present.
    if (token) {
      try {
        await this.attachSessionAuth(request, token);
        return true;
      } catch (error) {
        if (!direct) {
          if (error instanceof UnauthorizedException) {
            throw error;
          }
          throw new UnauthorizedException('Authentication required');
        }
        // Fall through to founder identity when cookie is invalid and direct mode is on.
      }
    } else if (!direct) {
      throw new UnauthorizedException('Authentication required');
    }

    request.auth = await this.founderAccess.resolveFounderAuth();
    return true;
  }

  private async attachSessionAuth(request: AuthedRequest, token: string): Promise<void> {
    const session = await this.sessions.resolveSession(token);

    request.auth = await this.tenantContext.resolve({
      userId: session.userId,
      sessionId: session.id,
      email: session.user.email,
      displayName: session.user.displayName,
      activeOrganizationId: session.activeOrganizationId,
      activeWorkspaceId: session.activeWorkspaceId ?? null,
    });

    // Persist cleared invalid org/workspace back to session (non-blocking best effort)
    if (
      session.activeOrganizationId !== request.auth.activeOrganizationId ||
      (session.activeWorkspaceId ?? null) !== request.auth.activeWorkspaceId
    ) {
      await this.sessions
        .setActiveTenant(
          session.id,
          request.auth.activeOrganizationId,
          request.auth.activeWorkspaceId,
        )
        .catch(() => undefined);
    }
  }
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[] | undefined>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const auth = request.auth;

    if (!auth) {
      throw new UnauthorizedException('Authentication required');
    }
    if (!auth.activeOrganizationId || !auth.role || !auth.tenant) {
      throw new ForbiddenException('Active organization required');
    }

    const missing = required.filter((p) => !auth.permissions.includes(p as never));
    if (missing.length > 0) {
      throw new ForbiddenException(`Missing permission: ${missing.join(', ')}`);
    }
    return true;
  }
}
