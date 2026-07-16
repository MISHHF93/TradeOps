import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { isAuthBypassEnabled } from '@tradeops/config';
import { permissionsForRole } from '@tradeops/domain';
import type { SystemRole } from '@tradeops/contracts';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { IS_PUBLIC_KEY, PERMISSIONS_KEY } from './decorators';
import { SessionService } from './session.service';
import type { AuthContext } from './types';

type AuthedRequest = Request & { auth?: AuthContext; cookies?: Record<string, string> };

const DEMO_EMAIL = 'founder@tradeops.local';
const DEMO_ORG_SLUG = 'demo-commerce';
const BYPASS_SESSION_ID = '00000000-0000-4000-a000-0000000000b1';
/** Avoid re-querying demo identity on every request (PGlite is slow under serial load). */
const BYPASS_AUTH_TTL_MS = 60_000;
let bypassAuthCache: { at: number; auth: AuthContext } | null = null;

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
    private readonly prisma: PrismaService,
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
    const bypass = isAuthBypassEnabled();

    // Prefer a real session cookie when present.
    if (token) {
      try {
        await this.attachSessionAuth(request, token);
        return true;
      } catch (error) {
        if (!bypass) {
          if (error instanceof UnauthorizedException) {
            throw error;
          }
          throw new UnauthorizedException('Authentication required');
        }
        // Fall through to bypass identity when cookie is missing/invalid.
      }
    } else if (!bypass) {
      throw new UnauthorizedException('Authentication required');
    }

    request.auth = await this.resolveBypassAuth();
    return true;
  }

  private async attachSessionAuth(request: AuthedRequest, token: string): Promise<void> {
    const session = await this.sessions.resolveSession(token);

    let role: SystemRole | null = null;
    let permissions: AuthContext['permissions'] = [];

    if (session.activeOrganizationId) {
      const membership = await this.prisma.client.membership.findUnique({
        where: {
          organizationId_userId: {
            organizationId: session.activeOrganizationId,
            userId: session.userId,
          },
        },
      });
      if (membership) {
        role = membership.role as SystemRole;
        permissions = permissionsForRole(role);
      } else {
        // Stale active org — clear for this request context
        session.activeOrganizationId = null;
      }
    }

    request.auth = {
      userId: session.userId,
      sessionId: session.id,
      activeOrganizationId: session.activeOrganizationId,
      role,
      permissions,
      email: session.user.email,
      displayName: session.user.displayName,
    };
  }

  /**
   * Impersonate the seeded demo owner (or the first user with a membership).
   * Requires `pnpm run setup:db` so commerce data is org-scoped correctly.
   */
  private async resolveBypassAuth(): Promise<AuthContext> {
    if (bypassAuthCache && Date.now() - bypassAuthCache.at < BYPASS_AUTH_TTL_MS) {
      return { ...bypassAuthCache.auth };
    }

    const userInclude = {
      memberships: {
        include: { organization: true },
        orderBy: { createdAt: 'asc' as const },
      },
    };

    let user = await this.prisma.client.user.findUnique({
      where: { email: DEMO_EMAIL },
      include: userInclude,
    });

    if (!user) {
      user = await this.prisma.client.user.findFirst({
        include: userInclude,
        orderBy: { createdAt: 'asc' },
      });
    }

    if (!user) {
      throw new UnauthorizedException(
        'AUTH_BYPASS is enabled but no users exist. Run: pnpm run setup:db',
      );
    }

    const membership =
      user.memberships.find((m) => m.organization.slug === DEMO_ORG_SLUG) ??
      user.memberships[0] ??
      null;

    if (!membership) {
      throw new UnauthorizedException(
        'AUTH_BYPASS is enabled but the user has no organization. Run: pnpm run setup:db',
      );
    }

    const role = membership.role as SystemRole;
    const auth: AuthContext = {
      userId: user.id,
      sessionId: BYPASS_SESSION_ID,
      activeOrganizationId: membership.organizationId,
      role,
      permissions: permissionsForRole(role),
      email: user.email,
      displayName: user.displayName,
    };
    bypassAuthCache = { at: Date.now(), auth };
    return { ...auth };
  }
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (isAuthBypassEnabled()) {
      return true;
    }

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
    if (!auth.activeOrganizationId || !auth.role) {
      throw new ForbiddenException('Active organization required');
    }

    const missing = required.filter((p) => !auth.permissions.includes(p as never));
    if (missing.length > 0) {
      throw new ForbiddenException(`Missing permission: ${missing.join(', ')}`);
    }
    return true;
  }
}
