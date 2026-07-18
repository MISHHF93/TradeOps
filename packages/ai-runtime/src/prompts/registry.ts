import { TRADEOPS_SYSTEM_PROMPT_V1 } from './system/tradeops-system-v1';
import { TRADEOPS_DEVELOPER_PROMPT_V1 } from './system/tradeops-developer-v1';
import {
  TASK_PROMPT_COMPLIANCE_V1,
  TASK_PROMPT_OPERATIONAL_V1,
  TASK_PROMPT_PROCUREMENT_V1,
  TASK_PROMPT_RESEARCH_V1,
} from './tasks/task-prompts-v1';

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

// System (behavioral) — primary operator identity
register(TRADEOPS_SYSTEM_PROMPT_V1 as PromptRecord);
// Developer — tool selection + synthesis constraints
register(TRADEOPS_DEVELOPER_PROMPT_V1 as PromptRecord);
// Task fragments — intent-specific
register(TASK_PROMPT_OPERATIONAL_V1 as PromptRecord);
register(TASK_PROMPT_RESEARCH_V1 as PromptRecord);
register(TASK_PROMPT_PROCUREMENT_V1 as PromptRecord);
register(TASK_PROMPT_COMPLIANCE_V1 as PromptRecord);

export function getPrompt(id: string, version?: string): PromptRecord | undefined {
  if (version) return prompts.get(`${id}@${version}`);
  return prompts.get(id);
}

export function requirePrompt(id: string, version?: string): PromptRecord {
  // Allow deploy-time pin via AI_PROMPT_VERSION (e.g. 1.0.0 or tradeops-system@1.0.0)
  const envRaw = process.env.AI_PROMPT_VERSION?.trim();
  if (!version && envRaw) {
    if (envRaw.includes('@')) {
      const [eid, ever] = envRaw.split('@');
      if (eid && ever) {
        const p = getPrompt(eid, ever);
        if (p) return p;
      }
    }
    // Bare version string
    if (/^\d+\.\d+/.test(envRaw)) {
      const p = getPrompt(id, envRaw);
      if (p) return p;
    }
    // Alias like tradeops-system-v1 → latest registered tradeops-system
    if (envRaw.startsWith('tradeops-system') || envRaw === 'tradeops-system-v1') {
      const p = getPrompt('tradeops-system', '1.0.0') ?? getPrompt('tradeops-system');
      if (p) return p;
    }
  }
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
