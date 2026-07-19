/**
 * Versioned schema registry for TradeOps AI artifacts.
 */

import { SYNTHESIS_JSON_SCHEMA } from './base-response';

export type SchemaRecord = {
  id: string;
  version: string;
  description: string;
  jsonSchema: Record<string, unknown>;
};

const schemas = new Map<string, SchemaRecord>();

function register(s: SchemaRecord) {
  schemas.set(`${s.id}@${s.version}`, s);
  schemas.set(s.id, s);
}

register({
  id: 'tradeops_synthesis',
  version: '1.0.0',
  description: 'Canonical Cohere synthesis payload (text + artifact + intent)',
  jsonSchema: SYNTHESIS_JSON_SCHEMA as unknown as Record<string, unknown>,
});

register({
  id: 'answer',
  version: '1.0.0',
  description: 'Simple conversational answer artifact',
  jsonSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['summary'],
    properties: {
      summary: { type: 'string' },
    },
  },
});

register({
  id: 'classification',
  version: '1.0.0',
  description: 'Intent / document classification artifact',
  jsonSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['label', 'confidence'],
    properties: {
      label: { type: 'string' },
      confidence: { type: 'number' },
      rationale: { type: 'string' },
    },
  },
});

register({
  id: 'research_report',
  version: '1.0.0',
  description: 'Public or mixed research findings',
  jsonSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['title', 'findings', 'openQuestions'],
    properties: {
      title: { type: 'string' },
      findings: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['claim', 'confidence'],
          properties: {
            claim: { type: 'string' },
            confidence: { type: 'number' },
            evidenceIds: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      openQuestions: { type: 'array', items: { type: 'string' } },
    },
  },
});

register({
  id: 'product_comparison',
  version: '1.0.0',
  description: 'Side-by-side product comparison',
  jsonSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['products', 'recommendation'],
    properties: {
      products: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'pros', 'cons'],
          properties: {
            name: { type: 'string' },
            sku: { type: 'string' },
            pros: { type: 'array', items: { type: 'string' } },
            cons: { type: 'array', items: { type: 'string' } },
            score: { type: 'number' },
          },
        },
      },
      recommendation: { type: 'string' },
    },
  },
});

register({
  id: 'supplier_comparison',
  version: '1.0.0',
  description: 'Supplier / quote comparison',
  jsonSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['suppliers', 'recommendation'],
    properties: {
      suppliers: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['name'],
          properties: {
            name: { type: 'string' },
            leadTimeDays: { type: 'number' },
            moq: { type: 'number' },
            notes: { type: 'string' },
          },
        },
      },
      recommendation: { type: 'string' },
    },
  },
});

register({
  id: 'operational_brief',
  version: '1.0.0',
  description: 'Operational status brief from connectors',
  jsonSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['headline', 'metrics', 'risks'],
    properties: {
      headline: { type: 'string' },
      metrics: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'value'],
          properties: {
            name: { type: 'string' },
            value: { type: 'string' },
            delta: { type: 'string' },
          },
        },
      },
      risks: { type: 'array', items: { type: 'string' } },
      nextSteps: { type: 'array', items: { type: 'string' } },
    },
  },
});

register({
  id: 'execution_plan',
  version: '1.0.0',
  description: 'Ordered execution plan with approval-aware steps',
  jsonSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['summary', 'steps'],
    properties: {
      summary: { type: 'string' },
      steps: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['title', 'requiresApproval'],
          properties: {
            title: { type: 'string' },
            owner: { type: 'string' },
            requiresApproval: { type: 'boolean' },
            capability: { type: 'string' },
          },
        },
      },
    },
  },
});

register({
  id: 'risk_assessment',
  version: '1.0.0',
  description: 'Policy / compliance risk assessment artifact',
  jsonSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['level', 'findings'],
    properties: {
      level: { type: 'string', description: 'low | medium | high | critical' },
      findings: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['title', 'severity'],
          properties: {
            title: { type: 'string' },
            severity: { type: 'string' },
            mitigation: { type: 'string' },
          },
        },
      },
      restricted: { type: 'boolean' },
      recommendation: { type: 'string' },
    },
  },
});

register({
  id: 'analytics_report',
  version: '1.0.0',
  description: 'Analytics / KPI report artifact',
  jsonSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['headline', 'metrics'],
    properties: {
      headline: { type: 'string' },
      metrics: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'value'],
          properties: {
            name: { type: 'string' },
            value: { type: 'string' },
            period: { type: 'string' },
            delta: { type: 'string' },
          },
        },
      },
      insights: { type: 'array', items: { type: 'string' } },
    },
  },
});

register({
  id: 'procurement_plan',
  version: '1.0.0',
  description: 'Procurement / RFQ plan artifact',
  jsonSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['summary', 'lineItems'],
    properties: {
      summary: { type: 'string' },
      lineItems: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['skuOrName', 'quantity'],
          properties: {
            skuOrName: { type: 'string' },
            quantity: { type: 'number' },
            targetUnitCost: { type: 'number' },
            supplier: { type: 'string' },
          },
        },
      },
      requiresApproval: { type: 'boolean' },
      risks: { type: 'array', items: { type: 'string' } },
    },
  },
});

register({
  id: 'document_extraction',
  version: '1.0.0',
  description: 'Structured extraction from documents / manuals / certificates',
  jsonSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['documentTitle', 'fields'],
    properties: {
      documentTitle: { type: 'string' },
      fields: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['key', 'value'],
          properties: {
            key: { type: 'string' },
            value: { type: 'string' },
            confidence: { type: 'number' },
          },
        },
      },
      sourceUri: { type: 'string' },
    },
  },
});

/** Canonical tool-result envelope returned by capability executor */
register({
  id: 'tool_result',
  version: '1.0.0',
  description: 'Normalized tool/capability execution result (TradeOps-owned)',
  jsonSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['ok', 'capability', 'data', 'warnings'],
    properties: {
      ok: { type: 'boolean' },
      capability: { type: 'string' },
      write: { type: 'boolean' },
      requiresApproval: { type: 'boolean' },
      informationClass: { type: 'string' },
      data: {
        type: 'object',
        description: 'Capability-specific payload; never invent operational facts',
      },
      evidence: {
        type: 'array',
        items: {
          type: 'object',
          required: ['sourceType', 'provider', 'retrievedAt'],
          properties: {
            sourceType: { type: 'string' },
            provider: { type: 'string' },
            title: { type: 'string' },
            url: { type: 'string' },
            snippet: { type: 'string' },
            retrievedAt: { type: 'string' },
            freshness: { type: 'string' },
          },
        },
      },
      actions: {
        type: 'array',
        items: {
          type: 'object',
          required: ['actionId', 'capability', 'status', 'requiresApproval'],
          properties: {
            actionId: { type: 'string' },
            capability: { type: 'string' },
            status: { type: 'string' },
            requiresApproval: { type: 'boolean' },
          },
        },
      },
      warnings: { type: 'array', items: { type: 'string' } },
      errorCode: { type: 'string' },
    },
  },
});

/** Frontend / API contract shape (mirrors TradeOpsCanonicalResponse) */
register({
  id: 'canonical_api_response',
  version: '1.0.0',
  description: 'Public API + frontend contract for AI chat responses',
  jsonSchema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'schemaVersion',
      'requestId',
      'tenantId',
      'conversationId',
      'status',
      'dataMode',
      'output',
      'evidence',
      'actions',
      'warnings',
      'confidence',
      'generatedAt',
    ],
    properties: {
      schemaVersion: { type: 'string' },
      requestId: { type: 'string' },
      tenantId: { type: 'string' },
      conversationId: { type: 'string' },
      status: { type: 'string', description: 'completed | partial | blocked | failed' },
      dataMode: { type: 'string', description: 'live | cached | simulation | unavailable' },
      output: {
        type: 'object',
        required: ['text', 'artifactType', 'artifact'],
        properties: {
          text: { type: 'string' },
          artifactType: { type: 'string' },
          artifact: { type: 'object' },
        },
      },
      evidence: { type: 'array' },
      actions: { type: 'array' },
      warnings: { type: 'array', items: { type: 'string' } },
      confidence: { type: 'number' },
      generatedAt: { type: 'string' },
      errorCode: { type: 'string' },
      requiredAction: { type: 'string' },
      intent: { type: 'object' },
      objective: { type: 'object' },
      provenance: { type: 'object' },
      meta: { type: 'object' },
    },
  },
});

export function getSchema(id: string, version?: string): SchemaRecord | undefined {
  if (version) return schemas.get(`${id}@${version}`);
  return schemas.get(id);
}

export function requireSchema(id: string, version?: string): SchemaRecord {
  const s = getSchema(id, version);
  if (!s) throw new Error(`Unknown schema: ${id}${version ? `@${version}` : ''}`);
  return s;
}

export function listSchemasPublic() {
  const out: Array<{ id: string; version: string; description: string }> = [];
  const seen = new Set<string>();
  for (const [k, s] of schemas) {
    if (k.includes('@') || seen.has(s.id)) continue;
    seen.add(s.id);
    out.push({ id: s.id, version: s.version, description: s.description });
  }
  return out;
}
