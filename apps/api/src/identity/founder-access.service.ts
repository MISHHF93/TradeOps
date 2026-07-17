import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  FOUNDER_DIRECT_DEFAULTS,
  founderAccessActive,
  isAuthBypassEnabled,
  loadEnv,
} from '@tradeops/config';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from './tenant-context.service';
import type { AuthContext } from './types';

/** Stable synthetic session id for direct founder requests (not a cookie session). */
export const FOUNDER_DIRECT_SESSION_ID = '00000000-0000-4000-a000-0000000000f1';

const CACHE_TTL_MS = 60_000;

/**
 * Idempotent founder workspace initializer + identity resolver.
 * Used when TRADEOPS_ACCESS_MODE=founder_direct (or legacy AUTH_BYPASS).
 *
 * Never destructive: does not delete products, connectors, orders, or credentials.
 * Still binds to a real tenant membership — not unrestricted multi-org data.
 */
@Injectable()
export class FounderAccessService implements OnModuleInit {
  private readonly logger = new Logger(FounderAccessService.name);
  private cache: { at: number; auth: AuthContext } | null = null;
  private bootstrapped = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!isAuthBypassEnabled()) {
      this.logger.log('Founder direct access inactive — session auth required');
      return;
    }
    try {
      const result = await this.ensureFounderWorkspace();
      this.logger.log(
        `Founder workspace ready: user=${result.email} org=${result.organizationSlug} createdUser=${result.createdUser} createdOrg=${result.createdOrg}`,
      );
      if (founderAccessActive()) {
        this.logger.warn(
          'TRADEOPS_ACCESS_MODE=founder_direct — no login required. Do not expose as a public multi-user SaaS.',
        );
      }
    } catch (err) {
      this.logger.error(
        `Founder workspace bootstrap failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Idempotent ensure of founder user + org + owner membership + founder persona.
   */
  async ensureFounderWorkspace(): Promise<{
    userId: string;
    organizationId: string;
    email: string;
    organizationSlug: string;
    createdUser: boolean;
    createdOrg: boolean;
  }> {
    const defaults = FOUNDER_DIRECT_DEFAULTS;
    let createdUser = false;
    let createdOrg = false;

    let user = await this.prisma.client.user.findUnique({
      where: { email: defaults.email },
    });
    if (!user) {
      user = await this.prisma.client.user.create({
        data: {
          email: defaults.email,
          displayName: defaults.displayName,
          passwordHash: null,
        },
      });
      createdUser = true;
    } else if (user.displayName !== defaults.displayName) {
      user = await this.prisma.client.user.update({
        where: { id: user.id },
        data: { displayName: defaults.displayName },
      });
    }

    // Prefer existing demo-commerce (seeded commerce data) to avoid data loss
    let org = await this.prisma.client.organization.findUnique({
      where: { slug: defaults.organizationSlug },
    });
    if (!org) {
      org = await this.prisma.client.organization.findUnique({
        where: { slug: defaults.fallbackOrganizationSlug },
      });
    }
    if (!org) {
      // Any org where this user is already owner
      const membership = await this.prisma.client.membership.findFirst({
        where: { userId: user.id, role: 'owner' },
        include: { organization: true },
        orderBy: { createdAt: 'asc' },
      });
      org = membership?.organization ?? null;
    }
    if (!org) {
      org = await this.prisma.client.organization.create({
        data: {
          name: defaults.organizationName,
          slug: defaults.organizationSlug,
          segment: 'individual',
          planTier: 'evaluation',
          deploymentMode: 'pooled',
          businessModel: 'founder_direct',
          onboardingStep: 'founder_direct',
          onboardingComplete: true,
        },
      });
      createdOrg = true;
    } else {
      // Soft metadata update only — never touch credentials or commerce rows
      org = await this.prisma.client.organization.update({
        where: { id: org.id },
        data: {
          name: defaults.organizationName,
          onboardingComplete: true,
          onboardingStep:
            org.onboardingStep === 'created' ? 'founder_direct' : org.onboardingStep,
        },
      });
    }

    const membership = await this.prisma.client.membership.upsert({
      where: {
        organizationId_userId: { organizationId: org.id, userId: user.id },
      },
      create: {
        organizationId: org.id,
        userId: user.id,
        role: defaults.role,
        workspacePersona: defaults.workspacePersona,
        status: 'active',
      },
      update: {
        role: defaults.role,
        workspacePersona: defaults.workspacePersona,
        status: 'active',
      },
    });

    // Ensure default workspace under tenant
    let workspace = await this.prisma.client.workspace.findFirst({
      where: { organizationId: org.id, isDefault: true },
    });
    if (!workspace) {
      workspace = await this.prisma.client.workspace.create({
        data: {
          organizationId: org.id,
          name: 'Default',
          slug: 'default',
          kind: 'default',
          isDefault: true,
          status: 'active',
        },
      });
    }
    await this.prisma.client.workspaceMembership.upsert({
      where: {
        workspaceId_userId: { workspaceId: workspace.id, userId: user.id },
      },
      create: {
        workspaceId: workspace.id,
        membershipId: membership.id,
        userId: user.id,
        organizationId: org.id,
        role: defaults.role,
      },
      update: {},
    });

    this.bootstrapped = true;
    this.cache = null; // force refresh after ensure

    return {
      userId: user.id,
      organizationId: org.id,
      email: user.email,
      organizationSlug: org.slug,
      createdUser,
      createdOrg,
    };
  }

  /** Resolve founder AuthContext for request guard (cached briefly). */
  async resolveFounderAuth(): Promise<AuthContext> {
    if (this.cache && Date.now() - this.cache.at < CACHE_TTL_MS) {
      return { ...this.cache.auth };
    }

    if (!this.bootstrapped) {
      await this.ensureFounderWorkspace();
    }

    const defaults = FOUNDER_DIRECT_DEFAULTS;
    const user = await this.prisma.client.user.findUnique({
      where: { email: defaults.email },
      include: {
        memberships: {
          include: { organization: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!user || user.memberships.length === 0) {
      // Retry bootstrap once
      await this.ensureFounderWorkspace();
      return this.resolveFounderAuth();
    }

    const membership =
      user.memberships.find((m) => m.organization.slug === defaults.organizationSlug) ??
      user.memberships.find((m) => m.organization.slug === defaults.fallbackOrganizationSlug) ??
      user.memberships.find((m) => m.role === 'owner') ??
      user.memberships[0];

    if (!membership) {
      throw new Error('Founder has no organization membership after bootstrap');
    }

    const defaultWs = await this.prisma.client.workspace.findFirst({
      where: { organizationId: membership.organizationId, isDefault: true },
    });

    const auth = await this.tenantContext.resolve({
      userId: user.id,
      sessionId: FOUNDER_DIRECT_SESSION_ID,
      email: user.email,
      displayName: user.displayName,
      activeOrganizationId: membership.organizationId,
      activeWorkspaceId: defaultWs?.id ?? null,
    });
    this.cache = { at: Date.now(), auth };
    return { ...auth };
  }

  describeMode() {
    const env = loadEnv();
    return {
      mode: env.TRADEOPS_ACCESS_MODE,
      founderDirect: founderAccessActive(env),
      directIdentity: isAuthBypassEnabled(env),
      founderEmail: FOUNDER_DIRECT_DEFAULTS.email,
      organizationSlug: FOUNDER_DIRECT_DEFAULTS.organizationSlug,
    };
  }
}
