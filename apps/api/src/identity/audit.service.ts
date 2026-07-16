import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type AuditWriteInput = {
  action: string;
  resourceType: string;
  resourceId?: string | null;
  organizationId?: string | null;
  actorUserId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async write(input: AuditWriteInput): Promise<void> {
    await this.prisma.client.auditEvent.create({
      data: {
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId ?? null,
        organizationId: input.organizationId ?? null,
        actorUserId: input.actorUserId ?? null,
        metadata: (input.metadata ?? {}) as object,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ? input.userAgent.slice(0, 512) : null,
      },
    });
  }
}
