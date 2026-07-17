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
import { FounderAccessService } from './founder-access.service';
import { SessionService } from './session.service';
import type { AuthContext } from './types';

type AuthedRequest = Request & { auth?: AuthContext; cookies?: Record<string, string> };

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
    private readonly prisma: PrismaService,
    private readonly founderAccess: FounderAccessService,
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

    // Public routes never hit here with required perms without auth context;
    // founder_direct still attaches owner permissions — enforce them (org ownership elsewhere).
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
