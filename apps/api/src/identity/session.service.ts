import { Injectable, UnauthorizedException } from '@nestjs/common';
import { loadEnv } from '@tradeops/config';
import {
  generateSessionToken,
  hashSessionToken,
  SESSION_COOKIE_NAME,
  buildSessionCookieOptions,
} from '@tradeops/auth';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';

export type RequestMeta = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  get cookieName(): string {
    return SESSION_COOKIE_NAME;
  }

  async createSession(
    userId: string,
    activeOrganizationId: string | null,
    meta: RequestMeta,
  ): Promise<string> {
    const env = loadEnv();
    const token = generateSessionToken();
    const tokenHash = hashSessionToken(token);
    const expiresAt = new Date(Date.now() + env.SESSION_TTL_HOURS * 60 * 60 * 1000);

    await this.prisma.client.session.create({
      data: {
        userId,
        tokenHash,
        activeOrganizationId,
        expiresAt,
        ipAddress: meta.ipAddress ?? null,
        userAgent: meta.userAgent ? meta.userAgent.slice(0, 512) : null,
      },
    });

    return token;
  }

  setSessionCookie(res: Response, token: string): void {
    const env = loadEnv();
    const options = buildSessionCookieOptions({
      isProduction: env.NODE_ENV === 'production',
      maxAgeSeconds: env.SESSION_TTL_HOURS * 60 * 60,
    });
    res.cookie(SESSION_COOKIE_NAME, token, options);
  }

  clearSessionCookie(res: Response): void {
    const env = loadEnv();
    res.clearCookie(SESSION_COOKIE_NAME, {
      path: '/',
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
    });
  }

  async resolveSession(token: string | undefined) {
    if (!token) {
      throw new UnauthorizedException('Authentication required');
    }

    const tokenHash = hashSessionToken(token);
    const session = await this.prisma.client.session.findUnique({
      where: { tokenHash },
      include: {
        user: true,
      },
    });

    if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Session expired or invalid');
    }

    return session;
  }

  async revokeByToken(token: string | undefined): Promise<void> {
    if (!token) {
      return;
    }
    const tokenHash = hashSessionToken(token);
    await this.prisma.client.session.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async setActiveOrganization(sessionId: string, organizationId: string): Promise<void> {
    await this.prisma.client.session.update({
      where: { id: sessionId },
      data: { activeOrganizationId: organizationId },
    });
  }

  async setActiveWorkspace(sessionId: string, workspaceId: string | null): Promise<void> {
    await this.prisma.client.session.update({
      where: { id: sessionId },
      data: { activeWorkspaceId: workspaceId },
    });
  }

  async setActiveTenant(
    sessionId: string,
    organizationId: string | null,
    workspaceId: string | null,
  ): Promise<void> {
    // Synthetic founder session is not a DB row
    if (sessionId === '00000000-0000-4000-a000-0000000000f1') {
      return;
    }
    await this.prisma.client.session.update({
      where: { id: sessionId },
      data: {
        activeOrganizationId: organizationId,
        activeWorkspaceId: workspaceId,
      },
    });
  }
}
