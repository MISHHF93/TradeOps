import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { hashPassword, verifyPassword } from '@tradeops/auth';
import type { AuthResponse, LoginRequest, RegisterRequest } from '@tradeops/contracts';
import { isValidOrganizationSlug, slugifyOrganizationName } from '@tradeops/domain';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit.service';
import { toAuthResponse } from './dto/mappers';
import { SessionService, type RequestMeta } from './session.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
  ) {}

  async register(
    input: RegisterRequest,
    res: Response,
    meta: RequestMeta,
  ): Promise<AuthResponse> {
    const email = input.email.trim().toLowerCase();
    const existing = await this.prisma.client.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    let slug = slugifyOrganizationName(input.organizationName);
    if (!isValidOrganizationSlug(slug)) {
      slug = `org-${Date.now().toString(36)}`;
    }
    slug = await this.ensureUniqueSlug(slug);

    const passwordHash = await hashPassword(input.password);

    const result = await this.prisma.client.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          displayName: input.displayName.trim(),
          passwordHash,
        },
      });

      const organization = await tx.organization.create({
        data: {
          name: input.organizationName.trim(),
          slug,
        },
      });

      const membership = await tx.membership.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          role: 'owner',
        },
        include: { organization: true },
      });

      return { user, membership };
    });

    const token = await this.sessions.createSession(
      result.user.id,
      result.membership.organizationId,
      meta,
    );
    this.sessions.setSessionCookie(res, token);

    await this.audit.write({
      action: 'auth.register',
      resourceType: 'user',
      resourceId: result.user.id,
      actorUserId: result.user.id,
      organizationId: result.membership.organizationId,
      metadata: { email },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return toAuthResponse({
      user: result.user,
      memberships: [result.membership],
      activeOrganizationId: result.membership.organizationId,
    });
  }

  async login(input: LoginRequest, res: Response, meta: RequestMeta): Promise<AuthResponse> {
    const email = input.email.trim().toLowerCase();
    const user = await this.prisma.client.user.findUnique({ where: { email } });

    if (!user?.passwordHash) {
      await this.audit.write({
        action: 'auth.login_failed',
        resourceType: 'user',
        metadata: { email, reason: 'unknown_user' },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    const valid = await verifyPassword(input.password, user.passwordHash);
    if (!valid) {
      await this.audit.write({
        action: 'auth.login_failed',
        resourceType: 'user',
        resourceId: user.id,
        actorUserId: user.id,
        metadata: { email, reason: 'bad_password' },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    const memberships = await this.prisma.client.membership.findMany({
      where: { userId: user.id },
      include: { organization: true },
      orderBy: { createdAt: 'asc' },
    });

    const activeOrganizationId = memberships[0]?.organizationId ?? null;
    const token = await this.sessions.createSession(user.id, activeOrganizationId, meta);
    this.sessions.setSessionCookie(res, token);

    await this.audit.write({
      action: 'auth.login',
      resourceType: 'user',
      resourceId: user.id,
      actorUserId: user.id,
      organizationId: activeOrganizationId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return toAuthResponse({
      user,
      memberships,
      activeOrganizationId,
    });
  }

  async logout(token: string | undefined, res: Response, meta: RequestMeta): Promise<void> {
    let userId: string | null = null;
    try {
      const session = await this.sessions.resolveSession(token);
      userId = session.userId;
    } catch {
      // still clear cookie
    }

    await this.sessions.revokeByToken(token);
    this.sessions.clearSessionCookie(res);

    if (userId) {
      await this.audit.write({
        action: 'auth.logout',
        resourceType: 'user',
        resourceId: userId,
        actorUserId: userId,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
    }
  }

  /** Short TTL cache for /auth/me — terminal SSR hits this on every page. */
  private meCache = new Map<string, { at: number; data: AuthResponse }>();
  private static readonly ME_TTL_MS = 30_000;

  async me(userId: string, activeOrganizationId: string | null): Promise<AuthResponse> {
    const key = `${userId}:${activeOrganizationId ?? 'none'}`;
    const hit = this.meCache.get(key);
    if (hit && Date.now() - hit.at < AuthService.ME_TTL_MS) {
      return hit.data;
    }

    const user = await this.prisma.client.user.findUniqueOrThrow({ where: { id: userId } });
    const memberships = await this.prisma.client.membership.findMany({
      where: { userId },
      include: { organization: true },
      orderBy: { createdAt: 'asc' },
    });

    const data = toAuthResponse({ user, memberships, activeOrganizationId });
    this.meCache.set(key, { at: Date.now(), data });
    return data;
  }

  private async ensureUniqueSlug(base: string): Promise<string> {
    let candidate = base;
    let attempt = 0;
    while (attempt < 20) {
      const existing = await this.prisma.client.organization.findUnique({
        where: { slug: candidate },
      });
      if (!existing) {
        return candidate;
      }
      attempt += 1;
      candidate = `${base.slice(0, 50)}-${attempt}`;
    }
    return `${base.slice(0, 40)}-${Date.now().toString(36)}`;
  }
}
