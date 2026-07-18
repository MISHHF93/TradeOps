/**
 * Provider-independent AI interface.
 * Only adapter implementations may import vendor SDKs.
 */

export type GenerateTextInput = {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
};

export type GenerateTextResult = {
  ok: boolean;
  text?: string;
  model?: string;
  latencyMs: number;
  error?: string;
  code?: string;
  usage?: { inputTokens?: number; outputTokens?: number };
};

export type StructuredGenerationInput = {
  system: string;
  user: string;
  /** JSON Schema for structured output */
  schema: Record<string, unknown>;
  schemaName: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
};

export type StructuredGenerationResult<T = unknown> = {
  ok: boolean;
  value?: T;
  rawText?: string;
  model?: string;
  latencyMs: number;
  error?: string;
  code?: string;
};

export type ToolSelectionInput = {
  system: string;
  user: string;
  tools: Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }>;
  temperature?: number;
  maxTokens?: number;
};

export type ToolSelectionResult = {
  ok: boolean;
  /** Empty = no tools needed */
  calls: Array<{ name: string; arguments: Record<string, unknown> }>;
  rawText?: string;
  latencyMs: number;
  error?: string;
};

export type EmbedInput = {
  texts: string[];
  inputType?: 'search_query' | 'search_document' | 'classification' | 'clustering';
  model?: string;
};

export type EmbedResult = {
  ok: boolean;
  vectors?: number[][];
  model?: string;
  latencyMs: number;
  error?: string;
};

export type RerankInput = {
  query: string;
  documents: string[];
  topN?: number;
  model?: string;
};

export type RerankResult = {
  ok: boolean;
  results?: Array<{ index: number; relevanceScore: number }>;
  latencyMs: number;
  error?: string;
};

export type ProviderHealth = {
  ok: boolean;
  configured: boolean;
  provider: string;
  model?: string;
  latencyMs: number;
  error?: string;
  checkedAt: string;
};

export interface AIProvider {
  readonly id: string;
  readonly configured: boolean;
  generateText(input: GenerateTextInput): Promise<GenerateTextResult>;
  generateStructured<T = unknown>(
    input: StructuredGenerationInput,
  ): Promise<StructuredGenerationResult<T>>;
  selectTools(input: ToolSelectionInput): Promise<ToolSelectionResult>;
  embed(input: EmbedInput): Promise<EmbedResult>;
  rerank(input: RerankInput): Promise<RerankResult>;
  healthCheck(): Promise<ProviderHealth>;
}

export type ResolveProviderOptions = {
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
};
