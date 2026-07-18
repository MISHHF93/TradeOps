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
