/**
 * Structured output schemas owned by TradeOps (versioned).
 */

export type JsonSchemaLite = {
  type: 'object';
  properties: Record<
    string,
    { type: string; description?: string; properties?: unknown; required?: string[] }
  >;
  required?: string[];
};

export type RegisteredSchema = {
  id: string;
  version: string;
  description: string;
  schema: JsonSchemaLite;
};

const schemas = new Map<string, RegisteredSchema>();

export function registerSchema(def: RegisteredSchema): void {
  schemas.set(def.id, def);
}

export function getSchema(id: string): RegisteredSchema | undefined {
  return schemas.get(id);
}

export function listSchemas(): RegisteredSchema[] {
  return [...schemas.values()].sort((a, b) => a.id.localeCompare(b.id));
}

registerSchema({
  id: 'execution_package',
  version: '1.0.0',
  description: 'AI Execution Navigator 10-section package',
  schema: {
    type: 'object',
    properties: {
      objective: { type: 'string' },
      currentState: { type: 'object' },
      liveEvidence: { type: 'object' },
      recommendations: { type: 'object' },
      executionPlan: { type: 'object' },
      timeline: { type: 'object' },
      dependencies: { type: 'object' },
      risks: { type: 'object' },
      executionStatus: { type: 'object' },
      verification: { type: 'object' },
    },
    required: ['objective', 'executionStatus'],
  },
});

registerSchema({
  id: 'search_response',
  version: '1.0.0',
  description: 'Unified search layer response',
  schema: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      hits: { type: 'object' },
      honesty: { type: 'object' },
    },
    required: ['query', 'hits'],
  },
});

registerSchema({
  id: 'operator_briefing',
  version: '1.0.0',
  description: 'Phase B generative operator briefing (Cohere structured JSON)',
  schema: {
    type: 'object',
    properties: {
      narrative: {
        type: 'string',
        description: 'Objective-specific briefing prose (no fixed template)',
      },
      topProductTitle: {
        type: 'string',
        description: 'Highest-ranked product title from tool evidence, or empty',
      },
      productCount: {
        type: 'number',
        description: 'Count of ranked recommendations',
      },
      confidenceNote: {
        type: 'string',
        description: 'One-line confidence / data quality note',
      },
      nextAction: {
        type: 'string',
        description: 'Recommended next production-safe action',
      },
      fixtureSourcesLabeled: {
        type: 'boolean',
        description: 'True if any fixture-labeled sources were used',
      },
    },
    required: [
      'narrative',
      'topProductTitle',
      'productCount',
      'confidenceNote',
      'nextAction',
      'fixtureSourcesLabeled',
    ],
  },
});

registerSchema({
  id: 'object_workspace',
  version: '1.0.0',
  description: 'Commerce Case / product object workspace',
  schema: {
    type: 'object',
    properties: {
      objectType: { type: 'string' },
      objectId: { type: 'string' },
      panels: { type: 'object' },
      graph: { type: 'object' },
      aiContext: { type: 'object' },
    },
    required: ['objectType', 'objectId'],
  },
});
