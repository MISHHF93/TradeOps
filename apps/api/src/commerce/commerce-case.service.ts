import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  STAGE_DEFINITIONS,
  buildCaseAiContext,
  buildStateEngineAiPreamble,
  canTransition,
  computeNextAction,
  deriveBlockersFromCases,
  deriveTasksFromCases,
  inferStageFromFacts,
  listSopTemplates,
  resolveCommerceState,
  validateStageTransition,
  validateTransformation,
  type CaseFacts,
  type CommerceStage,
  type CommerceStageStatus,
  type CommerceTransformation,
  type CommerceStateVector,
} from '@tradeops/commerce-engine';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../identity/audit.service';

type StageHistoryEntry = {
  stage: string;
  status: string;
  at: string;
  actorUserId?: string | null;
  note?: string;
};

/**
 * CommerceCase spine — one product opportunity through the operating procedure.
 */
@Injectable()
export class CommerceCaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Ensure every product has a case and stages reflect live records. */
  async syncOrganization(organizationId: string) {
    const products = await this.prisma.client.product.findMany({
      where: { organizationId },
      include: {
        opportunities: { orderBy: { createdAt: 'desc' }, take: 1 },
        listings: true,
        policyAssessments: { orderBy: { assessedAt: 'desc' }, take: 1 },
        orderLines: { include: { order: true } },
        supplierPurchaseOrders: true,
        predictionOutcomes: { take: 1 },
      },
    });

    const pendingApprovals = await this.prisma.client.approval.findMany({
      where: { organizationId, status: 'pending' },
      select: { listingId: true, supplierPurchaseOrderId: true, kind: true },
    });
    const pendingListingIds = new Set(
      pendingApprovals.map((a) => a.listingId).filter((id): id is string => Boolean(id)),
    );

    const fulfillments = await this.prisma.client.fulfillment.findMany({
      where: { organizationId },
      select: { customerOrderId: true, status: true },
    });
    const fulfillByOrder = new Map(fulfillments.map((f) => [f.customerOrderId, f]));

    let upserted = 0;
    for (const p of products) {
      const opp = p.opportunities[0];
      const draft = p.listings.find((l) => l.status === 'draft' || l.status === 'pending_approval');
      const active = p.listings.find((l) => l.status === 'active');
      const policy = p.policyAssessments[0];
      const orderIds = p.orderLines.map((l) => l.orderId);
      const hasPaidOrder = p.orderLines.some(
        (l) => l.order && ['paid', 'processing', 'fulfilled', 'shipped'].includes(l.order.status),
      );
      const hasFulfillment = orderIds.some((id) => fulfillByOrder.has(id));
      const hasDelivered = orderIds.some((id) => {
        const f = fulfillByOrder.get(id);
        return f && ['delivered', 'fulfilled'].includes(f.status);
      });
      const hasPendingApproval =
        Boolean(draft && pendingListingIds.has(draft.id)) ||
        p.listings.some((l) => pendingListingIds.has(l.id));

      const facts: CaseFacts = {
        hasProduct: true,
        hasOpportunity: Boolean(opp),
        opportunityScore: opp?.score ?? null,
        expectedProfitMinor: opp?.expectedProfitMinor ?? null,
        confidence: p.dataConfidence,
        policyOutcome: policy?.outcome ?? null,
        hasListingDraft: Boolean(draft),
        hasActiveListing: Boolean(active),
        hasPendingApproval,
        hasPaidOrder,
        hasSupplierPo: p.supplierPurchaseOrders.length > 0,
        hasFulfillment,
        hasDelivered,
        hasOutcome: p.predictionOutcomes.length > 0,
        blockedByPolicy: policy?.outcome === 'blocked',
      };

      const inferred = inferStageFromFacts(facts);
      const next = computeNextAction({
        currentStage: inferred.currentStage,
        stageStatus: inferred.stageStatus,
        productId: p.id,
        caseId: 'pending',
        facts,
        blockerMessage:
          inferred.stageStatus === 'blocked'
            ? 'Policy blocked — cannot prepare or publish'
            : null,
      });

      const existing = await this.prisma.client.commerceCase.findUnique({
        where: {
          organizationId_productId: { organizationId, productId: p.id },
        },
      });

      const history = (existing?.stageHistoryJson as StageHistoryEntry[] | null) ?? [];
      if (
        !existing ||
        existing.currentStage !== inferred.currentStage ||
        existing.stageStatus !== inferred.stageStatus
      ) {
        history.push({
          stage: inferred.currentStage,
          status: inferred.stageStatus,
          at: new Date().toISOString(),
          note: 'sync_from_records',
        });
      }

      const row = await this.prisma.client.commerceCase.upsert({
        where: {
          organizationId_productId: { organizationId, productId: p.id },
        },
        create: {
          organizationId,
          productId: p.id,
          listingDraftId: draft?.id ?? null,
          publishedListingId: active?.id ?? null,
          currentStage: inferred.currentStage,
          stageStatus: inferred.stageStatus,
          recommendation: inferred.recommendation ?? null,
          opportunityScore: opp?.score ?? null,
          confidence: p.dataConfidence,
          expectedProfitMinor: opp?.expectedProfitMinor ?? null,
          nextActionCode: next.code,
          nextActionLabel: next.label,
          blockerCode: inferred.stageStatus === 'blocked' ? 'policy_blocked' : null,
          blockerMessage:
            inferred.stageStatus === 'blocked'
              ? 'Policy blocked — cannot prepare or publish'
              : null,
          stageHistoryJson: history,
          metadataJson: { facts, nextHref: next.href },
        },
        update: {
          listingDraftId: draft?.id ?? null,
          publishedListingId: active?.id ?? null,
          currentStage: inferred.currentStage,
          stageStatus: inferred.stageStatus,
          recommendation: inferred.recommendation ?? null,
          opportunityScore: opp?.score ?? null,
          confidence: p.dataConfidence,
          expectedProfitMinor: opp?.expectedProfitMinor ?? null,
          nextActionCode: next.code,
          nextActionLabel: next.label,
          blockerCode: inferred.stageStatus === 'blocked' ? 'policy_blocked' : null,
          blockerMessage:
            inferred.stageStatus === 'blocked'
              ? 'Policy blocked — cannot prepare or publish'
              : null,
          stageHistoryJson: history.slice(-40),
          metadataJson: { facts, nextHref: next.href },
        },
      });

      // Fix next action href with real case id + Commerce State Engine snapshot
      const fixedNext = computeNextAction({
        currentStage: row.currentStage as CommerceStage,
        stageStatus: row.stageStatus as CommerceStageStatus,
        productId: p.id,
        caseId: row.id,
        facts,
        blockerMessage: row.blockerMessage,
      });
      const state = resolveCommerceState({
        caseId: row.id,
        productId: p.id,
        productTitle: p.title,
        organizationId,
        currentStage: row.currentStage as CommerceStage,
        stageStatus: row.stageStatus as CommerceStageStatus,
        facts,
        blockerCode: row.blockerCode,
        blockerMessage: row.blockerMessage,
        opportunityScore: opp?.score ?? null,
        confidence: p.dataConfidence,
        expectedProfitMinor: opp?.expectedProfitMinor ?? null,
        frictionInputs: {
          hasPrimaryImage: Boolean(p.primaryImageUrl),
          mediaCount: p.mediaCount ?? 0,
          hasBrand: Boolean(p.brand),
          hasAttributes:
            p.attributesJson != null &&
            typeof p.attributesJson === 'object' &&
            Object.keys(p.attributesJson as object).length > 0,
          supplierCostMinor: p.supplierCostMinor,
          shippingCostMinor: p.shippingCostMinor,
          targetPriceMinor: p.targetPriceMinor,
          inventoryQuantity: p.inventoryQuantity,
          inventoryKnown: true,
          shippingCostKnown: true,
          hasSupplierOffer: true,
          dataConfidence: p.dataConfidence,
        },
      });
      const rec = state.recommendedTransformation;
      await this.prisma.client.commerceCase.update({
        where: { id: row.id },
        data: {
          nextActionCode: rec?.code ?? fixedNext.code,
          nextActionLabel: rec?.label ?? fixedNext.label,
          metadataJson: {
            facts,
            nextHref: rec?.href ?? fixedNext.href,
            commerceState: {
              targetState: state.targetState,
              distanceToTarget: state.distanceToTarget,
              operationalFriction: state.operationalFriction,
              executionReadiness: state.executionReadiness,
              businessRisk: state.businessRisk,
              alignmentScore: state.matching.alignmentScore,
              recommendedTransformation: rec?.code ?? null,
              computedAt: state.computedAt,
            },
          } as object,
        },
      });
      upserted += 1;
    }

    return { upserted, stages: STAGE_DEFINITIONS };
  }

  async listProcess(organizationId: string) {
    await this.syncOrganization(organizationId);
    const cases = await this.prisma.client.commerceCase.findMany({
      where: { organizationId, currentStage: { not: 'closed' } },
      include: {
        product: {
          select: {
            id: true,
            title: true,
            category: true,
            sourcePlatform: true,
            currency: true,
            dataConfidence: true,
          },
        },
      },
      orderBy: [{ opportunityScore: 'desc' }, { updatedAt: 'desc' }],
    });

    const byStage: Record<string, typeof cases> = {};
    for (const s of STAGE_DEFINITIONS) {
      if (s.id === 'closed') continue;
      byStage[s.id] = [];
    }
    for (const c of cases) {
      const key = c.currentStage;
      if (!byStage[key]) byStage[key] = [];
      byStage[key]!.push(c);
    }

    const summary = {
      totalOpen: cases.length,
      blocked: cases.filter((c) => c.stageStatus === 'blocked').length,
      waiting: cases.filter((c) => c.stageStatus === 'waiting').length,
      awaitingApproval: cases.filter((c) => c.currentStage === 'approve').length,
      awaitingSource: cases.filter((c) => c.currentStage === 'sell').length,
    };

    return {
      stages: STAGE_DEFINITIONS.filter((s) => s.id !== 'closed'),
      summary,
      byStage: Object.fromEntries(
        Object.entries(byStage).map(([k, rows]) => [k, rows.map((r) => this.toDto(r))]),
      ),
      cases: cases.map((c) => this.toDto(c)),
      honesty: {
        note: 'Commerce Process is the operational spine. Scanner/signals/watchlist are views into the same cases.',
      },
    };
  }

  async getCaseByProduct(organizationId: string, productId: string) {
    await this.syncOrganization(organizationId);
    const c = await this.prisma.client.commerceCase.findUnique({
      where: {
        organizationId_productId: { organizationId, productId },
      },
    });
    if (!c) throw new NotFoundException('Commerce case not found for product');
    return this.getCase(organizationId, c.id);
  }

  async getCase(organizationId: string, caseId: string) {
    await this.syncOrganization(organizationId);
    const c = await this.prisma.client.commerceCase.findFirst({
      where: { id: caseId, organizationId },
      include: {
        product: {
          include: {
            opportunities: { orderBy: { createdAt: 'desc' }, take: 1 },
            listings: true,
            offers: { include: { supplier: true }, take: 5 },
            policyAssessments: { orderBy: { assessedAt: 'desc' }, take: 1 },
            artifacts: { take: 12, orderBy: { collectedAt: 'desc' } },
          },
        },
      },
    });
    if (!c) throw new NotFoundException('Commerce case not found');

    const meta = (c.metadataJson ?? {}) as { facts?: CaseFacts; nextHref?: string };
    const history = (c.stageHistoryJson ?? []) as StageHistoryEntry[];
    const stageDefs = STAGE_DEFINITIONS.filter((s) => s.id !== 'closed');
    const currentIdx = stageDefs.findIndex((s) => s.id === c.currentStage);

    return {
      case: this.toDto(c),
      product: {
        id: c.product.id,
        title: c.product.title,
        category: c.product.category,
        sourcePlatform: c.product.sourcePlatform,
        currency: c.product.currency,
        dataConfidence: c.product.dataConfidence,
        supplierCostMinor: c.product.supplierCostMinor,
        shippingCostMinor: c.product.shippingCostMinor,
        targetPriceMinor: c.product.targetPriceMinor,
      },
      opportunity: c.product.opportunities[0] ?? null,
      listings: c.product.listings,
      offers: c.product.offers,
      policy: c.product.policyAssessments[0] ?? null,
      artifacts: c.product.artifacts.map((a) => ({
        id: a.id,
        artifactType: a.artifactType,
        purpose: a.purpose,
        rightsStatus: a.rightsStatus,
        publicationStatus: a.publicationStatus,
        title: a.title,
      })),
      lifecycle: stageDefs.map((s, i) => ({
        ...s,
        state:
          i < currentIdx
            ? 'completed'
            : i === currentIdx
              ? c.stageStatus
              : 'future',
      })),
      history,
      facts: meta.facts ?? null,
      nextHref: meta.nextHref ?? `/terminal/process/${c.id}`,
      handoffLabel:
        STAGE_DEFINITIONS.find((s) => s.id === c.currentStage)?.handoffLabel ?? 'Continue',
    };
  }

  async advance(
    organizationId: string,
    caseId: string,
    toStage: string,
    userId?: string | null,
  ) {
    const c = await this.prisma.client.commerceCase.findFirst({
      where: { id: caseId, organizationId },
    });
    if (!c) throw new NotFoundException('Commerce case not found');

    const from = c.currentStage as CommerceStage;
    const to = toStage as CommerceStage;
    if (!canTransition(from, to)) {
      throw new BadRequestException(`Invalid stage transition ${from} → ${to}`);
    }

    // Recompute facts for validation
    await this.syncOrganization(organizationId);
    const fresh = await this.prisma.client.commerceCase.findFirst({
      where: { id: caseId, organizationId },
    });
    if (!fresh) throw new NotFoundException('Commerce case not found');
    const facts = ((fresh.metadataJson as { facts?: CaseFacts })?.facts ?? {
      hasProduct: true,
      hasOpportunity: false,
      hasListingDraft: false,
      hasActiveListing: false,
      hasPendingApproval: false,
      hasPaidOrder: false,
      hasSupplierPo: false,
      hasFulfillment: false,
      hasDelivered: false,
      hasOutcome: false,
      blockedByPolicy: false,
    }) as CaseFacts;

    const validation = validateStageTransition(from, to, facts);
    if (!validation.ok) {
      throw new BadRequestException(
        validation.reason +
          (validation.missing?.length ? ` (missing: ${validation.missing.join(', ')})` : ''),
      );
    }

    const history = (fresh.stageHistoryJson as StageHistoryEntry[]) ?? [];
    history.push({
      stage: to,
      status: 'in_progress',
      at: new Date().toISOString(),
      actorUserId: userId ?? null,
      note: `advance ${from}→${to}`,
    });

    const next = computeNextAction({
      currentStage: to,
      stageStatus: 'in_progress',
      productId: fresh.productId,
      caseId: fresh.id,
      facts,
    });

    const updated = await this.prisma.client.commerceCase.update({
      where: { id: fresh.id },
      data: {
        currentStage: to,
        stageStatus: 'in_progress',
        nextActionCode: next.code,
        nextActionLabel: next.label,
        stageHistoryJson: history.slice(-40),
        metadataJson: {
          ...(typeof fresh.metadataJson === 'object' && fresh.metadataJson
            ? (fresh.metadataJson as object)
            : {}),
          facts,
          nextHref: next.href,
        },
      },
      include: {
        product: { select: { id: true, title: true, category: true, sourcePlatform: true, currency: true, dataConfidence: true } },
      },
    });

    await this.audit.write({
      action: 'commerce_case.advance',
      resourceType: 'commerce_case',
      resourceId: updated.id,
      organizationId,
      actorUserId: userId ?? null,
      metadata: { from, to },
    });

    return this.toDto(updated);
  }

  async terminalSummary(organizationId: string) {
    const board = await this.listProcess(organizationId);
    const urgent = board.cases
      .filter(
        (c) =>
          c.stageStatus === 'blocked' ||
          c.stageStatus === 'waiting' ||
          c.currentStage === 'approve' ||
          c.currentStage === 'sell' ||
          c.currentStage === 'fulfill',
      )
      .slice(0, 12);

    return {
      summary: board.summary,
      stages: board.stages.map((s) => ({
        id: s.id,
        title: s.title,
        count: board.byStage[s.id]?.length ?? 0,
      })),
      urgent,
      processHref: '/terminal/process',
      tasksHref: '/terminal/tasks',
    };
  }

  async listTasks(organizationId: string) {
    const board = await this.listProcess(organizationId);
    const inputs = board.cases.map((c) => ({
      caseId: c.id,
      productId: c.productId,
      productTitle: c.productTitle,
      currentStage: c.currentStage as CommerceStage,
      stageStatus: c.stageStatus as CommerceStageStatus,
      nextActionCode: c.nextActionCode,
      nextActionLabel: c.nextActionLabel,
      nextHref: c.nextHref,
      blockerCode: c.blockerCode,
      blockerMessage: c.blockerMessage,
      opportunityScore: c.opportunityScore,
    }));
    const tasks = deriveTasksFromCases(inputs);
    const blockers = deriveBlockersFromCases(inputs);
    return {
      tasks,
      blockers,
      sops: listSopTemplates().map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        stepCount: s.steps.length,
      })),
      honesty: {
        note: 'Tasks are derived from CommerceCase next actions and blockers — same spine as the Process board.',
      },
    };
  }

  /**
   * Commerce State Resolver — full state vector for a case (Smith-inspired discipline).
   */
  async resolveState(
    organizationId: string,
    caseId: string,
    opts?: { persona?: string | null },
  ): Promise<CommerceStateVector> {
    await this.syncOrganization(organizationId);
    const c = await this.prisma.client.commerceCase.findFirst({
      where: { id: caseId, organizationId },
      include: {
        product: true,
      },
    });
    if (!c) throw new NotFoundException('Commerce case not found');

    const facts = ((c.metadataJson as { facts?: CaseFacts })?.facts ?? {
      hasProduct: true,
      hasOpportunity: c.opportunityScore != null,
      opportunityScore: c.opportunityScore,
      expectedProfitMinor: c.expectedProfitMinor,
      confidence: c.confidence,
      hasListingDraft: Boolean(c.listingDraftId),
      hasActiveListing: Boolean(c.publishedListingId),
      hasPendingApproval: false,
      hasPaidOrder: false,
      hasSupplierPo: false,
      hasFulfillment: false,
      hasDelivered: false,
      hasOutcome: false,
      blockedByPolicy: c.blockerCode === 'policy_blocked',
    }) as CaseFacts;

    const p = c.product;
    return resolveCommerceState({
      caseId: c.id,
      productId: c.productId,
      productTitle: p.title,
      organizationId,
      currentStage: c.currentStage as CommerceStage,
      stageStatus: c.stageStatus as CommerceStageStatus,
      facts,
      blockerCode: c.blockerCode,
      blockerMessage: c.blockerMessage,
      opportunityScore: c.opportunityScore,
      confidence: c.confidence ?? p.dataConfidence,
      expectedProfitMinor: c.expectedProfitMinor,
      persona: opts?.persona,
      frictionInputs: {
        hasPrimaryImage: Boolean(p.primaryImageUrl),
        mediaCount: p.mediaCount ?? 0,
        hasBrand: Boolean(p.brand),
        hasAttributes:
          p.attributesJson != null &&
          typeof p.attributesJson === 'object' &&
          Object.keys(p.attributesJson as object).length > 0,
        supplierCostMinor: p.supplierCostMinor,
        shippingCostMinor: p.shippingCostMinor,
        targetPriceMinor: p.targetPriceMinor,
        inventoryQuantity: p.inventoryQuantity,
        inventoryKnown: true,
        shippingCostKnown: true,
        hasSupplierOffer: true,
        dataConfidence: p.dataConfidence,
      },
    });
  }

  /** Org-wide state board: ranked by execution readiness / friction */
  async resolveOrgStates(organizationId: string, opts?: { persona?: string | null }) {
    const board = await this.listProcess(organizationId);
    const states: CommerceStateVector[] = [];
    for (const c of board.cases.slice(0, 40)) {
      try {
        states.push(await this.resolveState(organizationId, c.id, opts));
      } catch {
        /* skip */
      }
    }
    states.sort((a, b) => {
      if (a.blockers.length !== b.blockers.length) return b.blockers.length - a.blockers.length;
      return a.operationalFriction - b.operationalFriction;
    });
    return {
      cases: states,
      summary: {
        total: states.length,
        avgFriction:
          states.length === 0
            ? 0
            : Math.round(
                (states.reduce((s, x) => s + x.operationalFriction, 0) / states.length) * 10,
              ) / 10,
        avgReadiness:
          states.length === 0
            ? 0
            : Math.round(
                states.reduce((s, x) => s + x.executionReadiness, 0) / states.length,
              ),
        blocked: states.filter((s) => s.blockers.length > 0).length,
      },
      honesty: {
        note: 'Commerce State Engine ranks cases by friction and readiness — not page navigation.',
      },
    };
  }

  /**
   * Apply a named transformation: audit + optional stage advance.
   * AI should call this rather than inventing free-form navigation.
   */
  async applyTransformation(
    organizationId: string,
    caseId: string,
    code: string,
    userId?: string | null,
  ) {
    const state = await this.resolveState(organizationId, caseId);
    const transform = code as CommerceTransformation;
    const facts = (await this.loadFacts(organizationId, caseId)) as CaseFacts;
    const validation = validateTransformation(
      {
        caseId,
        productId: state.productId,
        currentStage: state.currentState,
        stageStatus: state.stageStatus,
        facts,
      },
      transform,
    );
    if (!validation.ok) {
      throw new BadRequestException(validation.reason ?? 'Invalid transformation');
    }

    let advanced = null;
    if (
      validation.toStage &&
      validation.toStage !== state.currentState &&
      canTransition(state.currentState, validation.toStage)
    ) {
      advanced = await this.advance(organizationId, caseId, validation.toStage, userId);
    }

    await this.audit.write({
      action: 'commerce_state.transform',
      resourceType: 'commerce_case',
      resourceId: caseId,
      organizationId,
      actorUserId: userId ?? null,
      metadata: {
        transformation: code,
        from: state.currentState,
        to: validation.toStage,
        frictionBefore: state.operationalFriction,
        recommendedWas: state.recommendedTransformation?.code,
      },
    });

    const nextState = await this.resolveState(organizationId, caseId);
    return {
      applied: code,
      advanced: Boolean(advanced),
      state: nextState,
      frictionDelta:
        Math.round((state.operationalFriction - nextState.operationalFriction) * 10) / 10,
    };
  }

  private async loadFacts(organizationId: string, caseId: string): Promise<CaseFacts> {
    const c = await this.prisma.client.commerceCase.findFirst({
      where: { id: caseId, organizationId },
    });
    if (!c) throw new NotFoundException('Commerce case not found');
    return ((c.metadataJson as { facts?: CaseFacts })?.facts ?? {
      hasProduct: true,
      hasOpportunity: false,
      hasListingDraft: false,
      hasActiveListing: false,
      hasPendingApproval: false,
      hasPaidOrder: false,
      hasSupplierPo: false,
      hasFulfillment: false,
      hasDelivered: false,
      hasOutcome: false,
      blockedByPolicy: false,
    }) as CaseFacts;
  }

  async getCaseAiContext(organizationId: string, caseId: string) {
    const detail = await this.getCase(organizationId, caseId);
    const c = detail.case;
    const state = await this.resolveState(organizationId, caseId);
    const context = buildCaseAiContext({
      caseId: c.id,
      productTitle: detail.product.title,
      currentStage: c.currentStage as CommerceStage,
      stageStatus: c.stageStatus as CommerceStageStatus,
      nextActionLabel: c.nextActionLabel,
      blockerMessage: c.blockerMessage,
      opportunityScore: c.opportunityScore,
    });
    const statePreamble = buildStateEngineAiPreamble(state);
    return {
      caseId: c.id,
      productId: c.productId,
      currentStage: c.currentStage,
      stageStatus: c.stageStatus,
      nextActionLabel: c.nextActionLabel,
      contextPreamble: `${statePreamble}\n\n${context}`,
      commerceState: state,
      suggestedObjectives: this.suggestedObjectivesForStage(
        c.currentStage as CommerceStage,
        detail.product.title,
      ),
    };
  }

  private suggestedObjectivesForStage(stage: CommerceStage, title: string): string[] {
    switch (stage) {
      case 'discover':
      case 'evaluate':
        return [
          `Evaluate economics and policy risk for ${title}`,
          `Recalculate margin with a higher return reserve for ${title}`,
        ];
      case 'qualify':
        return [`Explain why ${title} is qualified, watch, or blocked under current policy`];
      case 'prepare':
        return [
          `Prepare listing readiness for ${title} including media rights`,
          `Compare supplier offers for ${title} and recommend one`,
        ];
      case 'approve':
        return [`Explain why publication of ${title} requires approval and what evidence is attached`];
      case 'fulfill':
        return [`Investigate fulfillment status for orders of ${title} and draft a customer update`];
      case 'reconcile':
      case 'learn':
        return [`Compare predicted vs realized performance for ${title}`];
      default:
        return [`Summarize commerce case status for ${title} and the single next action`];
    }
  }

  private toDto(c: {
    id: string;
    productId: string;
    currentStage: string;
    stageStatus: string;
    recommendation: string | null;
    opportunityScore: number | null;
    confidence: number | null;
    expectedProfitMinor: number | null;
    realizedProfitMinor: number | null;
    nextActionCode: string | null;
    nextActionLabel: string | null;
    blockerCode: string | null;
    blockerMessage: string | null;
    listingDraftId: string | null;
    publishedListingId: string | null;
    updatedAt: Date;
    createdAt: Date;
    product?: {
      id: string;
      title: string;
      category: string;
      sourcePlatform: string;
      currency: string;
      dataConfidence: number;
    };
    metadataJson?: unknown;
  }) {
    const meta = (c.metadataJson ?? {}) as { nextHref?: string };
    return {
      id: c.id,
      productId: c.productId,
      productTitle: c.product?.title,
      category: c.product?.category,
      sourcePlatform: c.product?.sourcePlatform,
      currency: c.product?.currency,
      currentStage: c.currentStage,
      stageStatus: c.stageStatus,
      recommendation: c.recommendation,
      opportunityScore: c.opportunityScore,
      confidence: c.confidence ?? c.product?.dataConfidence ?? null,
      expectedProfitMinor: c.expectedProfitMinor,
      realizedProfitMinor: c.realizedProfitMinor,
      nextActionCode: c.nextActionCode,
      nextActionLabel: c.nextActionLabel,
      nextHref: meta.nextHref ?? `/terminal/process/${c.id}`,
      blockerCode: c.blockerCode,
      blockerMessage: c.blockerMessage,
      listingDraftId: c.listingDraftId,
      publishedListingId: c.publishedListingId,
      updatedAt: c.updatedAt,
      createdAt: c.createdAt,
      journeyHref: `/terminal/process/${c.id}`,
      productHref: `/terminal/products/${c.productId}`,
    };
  }
}
