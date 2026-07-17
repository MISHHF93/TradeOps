import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  assessProductPolicy,
  calculateUnitEconomics,
  scoreOpportunity,
} from '@tradeops/commerce-engine';
import {
  FOUNDER_DIRECT_DEFAULTS,
  founderAccessActive,
  isAuthBypassEnabled,
  loadEnv,
  publicAccessWarning,
} from '@tradeops/config';
import { Public } from '../identity/decorators';
import { capabilitySummary, listCapabilities } from './capabilities';

/**
 * Public free tools for the benefit website.
 * Pure calculations — no private merchant data, no credentials.
 */
@Controller('public')
export class PublicToolsController {
  @Public()
  @Get('tools/catalog')
  catalog() {
    return {
      tools: [
        {
          id: 'unit-economics',
          path: '/api/v1/public/tools/unit-economics',
          description: 'Contribution profit calculator — revenue is never profit',
        },
        {
          id: 'opportunity-score',
          path: '/api/v1/public/tools/opportunity-score',
          description: 'Explainable 0–100 product opportunity score',
        },
        {
          id: 'policy-check',
          path: '/api/v1/public/tools/policy-check',
          description: 'Fail-closed product policy gate (restricted categories)',
        },
      ],
      note: 'Free public calculators. They do not access private store data.',
    };
  }

  /**
   * Access mode for web routing / UI composition.
   * No private merchant data. Central switch for founder_direct vs auth.
   */
  @Public()
  @Get('access-mode')
  accessMode() {
    const env = loadEnv();
    const warning = publicAccessWarning(env);
    return {
      mode: env.TRADEOPS_ACCESS_MODE,
      founderDirect: founderAccessActive(env),
      directIdentity: isAuthBypassEnabled(env),
      founderEmail: founderAccessActive(env) ? FOUNDER_DIRECT_DEFAULTS.email : null,
      organizationSlug: founderAccessActive(env)
        ? FOUNDER_DIRECT_DEFAULTS.organizationSlug
        : null,
      publicWarning: warning,
      note: founderAccessActive(env)
        ? 'Direct Founder Access — open /terminal without login. Auth architecture retained for authenticated/multi_tenant modes.'
        : 'Session authentication required for private surfaces.',
    };
  }

  /**
   * Launch honesty board — no private merchant data.
   * Used by public /status page and operators.
   */
  @Public()
  @Get('capabilities')
  capabilities() {
    const env = loadEnv();
    const hasGoogle = Boolean(
      process.env.GOOGLE_MERCHANT_ACCESS_TOKEN?.trim() &&
        process.env.GOOGLE_MERCHANT_ID?.trim(),
    );
    const entries = listCapabilities({
      hasGoogleCredentials: hasGoogle,
      authBypass: isAuthBypassEnabled(env),
    });
    return {
      generatedAt: new Date().toISOString(),
      accessMode: env.TRADEOPS_ACCESS_MODE,
      entries,
      summary: capabilitySummary(entries),
      note: 'Statuses describe runtime honesty, not marketing claims.',
    };
  }

  @Public()
  @Post('tools/unit-economics')
  unitEconomics(
    @Body()
    body: {
      sellingPriceMinor?: number;
      marketplaceFeeMinor?: number;
      paymentFeeMinor?: number;
      supplierCostMinor?: number;
      shippingCostMinor?: number;
      dutiesMinor?: number;
      advertisingAllocationMinor?: number;
      returnReserveMinor?: number;
      currency?: string;
      units?: number;
    },
  ) {
    try {
      const result = calculateUnitEconomics({
        sellingPriceMinor: Number(body.sellingPriceMinor ?? 0),
        marketplaceFeeMinor: Number(body.marketplaceFeeMinor ?? 0),
        paymentFeeMinor: Number(body.paymentFeeMinor ?? 0),
        supplierCostMinor: Number(body.supplierCostMinor ?? 0),
        shippingCostMinor: Number(body.shippingCostMinor ?? 0),
        dutiesMinor: Number(body.dutiesMinor ?? 0),
        advertisingAllocationMinor: Number(body.advertisingAllocationMinor ?? 0),
        returnReserveMinor: Number(body.returnReserveMinor ?? 0),
        currency: body.currency ?? 'USD',
        units: Number(body.units ?? 1),
      });
      return {
        ok: true,
        result,
        disclaimer:
          'Contribution profit estimate only. Does not include all operating overhead. Not financial advice.',
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Invalid input',
      };
    }
  }

  @Public()
  @Post('tools/opportunity-score')
  opportunityScore(
    @Body()
    body: {
      demandPotential?: number;
      trendMomentum?: number;
      netMarginPotential?: number;
      supplierQuality?: number;
      shippingReliability?: number;
      reviewHealth?: number;
      competition?: number;
      returnRisk?: number;
      policyRisk?: number;
      capitalRequirement?: number;
      dataConfidence?: number;
      policyBlocked?: boolean;
    },
  ) {
    const result = scoreOpportunity({
      demandPotential: Number(body.demandPotential ?? 50),
      trendMomentum: Number(body.trendMomentum ?? 50),
      netMarginPotential: Number(body.netMarginPotential ?? 50),
      supplierQuality: Number(body.supplierQuality ?? 50),
      shippingReliability: Number(body.shippingReliability ?? 50),
      reviewHealth: Number(body.reviewHealth ?? 50),
      competition: Number(body.competition ?? 50),
      returnRisk: Number(body.returnRisk ?? 50),
      policyRisk: Number(body.policyRisk ?? 20),
      capitalRequirement: Number(body.capitalRequirement ?? 40),
      dataConfidence: Number(body.dataConfidence ?? 70),
      policyBlocked: Boolean(body.policyBlocked),
    });
    return {
      ok: true,
      result,
      disclaimer: 'Explainable heuristic score for education and planning — not a guarantee of sales.',
    };
  }

  @Public()
  @Post('tools/policy-check')
  policyCheck(
    @Body()
    body: {
      title?: string;
      description?: string;
      category?: string;
    },
  ) {
    const result = assessProductPolicy({
      title: body.title ?? '',
      description: body.description,
      category: body.category,
    });
    return {
      ok: true,
      result,
      disclaimer: 'Keyword/category gate only. Not legal advice. Marketplace policies still apply.',
    };
  }
}
