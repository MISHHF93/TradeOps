import { createParamDecorator, ExecutionContext, ForbiddenException, SetMetadata } from '@nestjs/common';
import type { Permission } from '@tradeops/contracts';
import type { TenantContext } from '@tradeops/domain';
import type { AuthContext } from './types';

export const IS_PUBLIC_KEY = 'isPublic';
export const PERMISSIONS_KEY = 'permissions';

/** Mark a route as public (no session required). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Require all listed permissions on the active organization role. */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

export const CurrentAuth = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthContext => {
    const request = ctx.switchToHttp().getRequest<{ auth?: AuthContext }>();
    if (!request.auth) {
      throw new Error('Auth context missing — AuthGuard must run first');
    }
    return request.auth;
  },
);

/** Require fully resolved tenant context (membership-validated). */
export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TenantContext => {
    const request = ctx.switchToHttp().getRequest<{ auth?: AuthContext }>();
    if (!request.auth?.tenant) {
      throw new ForbiddenException('Active organization membership required');
    }
    return request.auth.tenant;
  },
);
