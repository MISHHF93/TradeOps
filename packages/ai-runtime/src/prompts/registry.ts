import { TRADEOPS_SYSTEM_PROMPT_V1 } from './system/tradeops-system-v1';

export type PromptRecord = {
  id: string;
  version: string;
  description: string;
  createdAt: string;
  changeNotes: string;
  supportedSchemas: readonly string[];
  text: string;
};

const prompts = new Map<string, PromptRecord>();

function register(p: PromptRecord) {
  prompts.set(`${p.id}@${p.version}`, p);
  prompts.set(p.id, p); // latest alias
}

register(TRADEOPS_SYSTEM_PROMPT_V1 as PromptRecord);

export function getPrompt(id: string, version?: string): PromptRecord | undefined {
  if (version) return prompts.get(`${id}@${version}`);
  return prompts.get(id);
}

export function requirePrompt(id: string, version?: string): PromptRecord {
  const p = getPrompt(id, version);
  if (!p) throw new Error(`Unknown prompt: ${id}${version ? `@${version}` : ''}`);
  return p;
}

export function listPromptsPublic() {
  const seen = new Set<string>();
  const out: Array<{ id: string; version: string; description: string }> = [];
  for (const [k, p] of prompts) {
    if (k.includes('@')) continue;
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    out.push({ id: p.id, version: p.version, description: p.description });
  }
  return out;
}
