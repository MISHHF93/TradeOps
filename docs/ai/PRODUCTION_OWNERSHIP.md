# Production Cohere AI — ownership model

## Rule

**TradeOps source code owns all production AI behavior.**  
**Cohere is the model provider only.**  
**Cohere Playground is not a configuration store.**

```text
TradeOps source code
→ prompt registry
→ schema registry
→ tool / capability registry + approval policies
→ AI runtime (runCohereAgentLoop)
→ Cohere provider (createCohereProvider)
→ tool / capability executor
→ structured synthesis
→ runtime validation (validateSynthesisPayload)
→ canonical API response (TradeOpsCanonicalResponse)
→ frontend artifact renderer
→ persistence (AiChatService → AiConversation / AiMessage)
```

## Source map

| Concern | Location |
|---------|----------|
| System instructions | `packages/ai-runtime/src/prompts/system/tradeops-system-v1.ts` |
| Developer instructions | `packages/ai-runtime/src/prompts/system/tradeops-developer-v1.ts` |
| Task prompts | `packages/ai-runtime/src/prompts/tasks/task-prompts-v1.ts` |
| Prompt versions / pin | `prompts/registry.ts` + `AI_PROMPT_VERSION` |
| Model configuration | `@tradeops/config` `getAiPlatformConfig` / env |
| Synthesis JSON schema | `schemas/base-response.ts` `SYNTHESIS_JSON_SCHEMA` |
| Artifact schemas | `schemas/registry.ts` |
| Tool-result schema | `schemas/registry.ts` id `tool_result` |
| Canonical API / frontend contract | `TradeOpsCanonicalResponse` + `apps/web/src/lib/ai-response-contract.ts` |
| Capabilities / tools | `capability-catalog.ts` + `capability-executor.ts` |
| Provider tool definitions | `tools/provider-tools.ts` |
| Tool parameter + approval policies | `tool-policies.ts` |
| Agent roles / orchestration | `agent-orchestration.ts` (preferredTools = capability names) |
| Agent loop | `runtime/agent-loop.ts` |
| Search policies | `search-manager.ts` |
| Retrieval | `retrieval-engine.ts` |
| Provenance | `runtime-provenance.ts` |
| Cohere HTTP adapter | `provider/cohere-provider.ts` |
| Provider resolution (fail-closed) | `provider/resolve-provider.ts` — `AI_PROVIDER=cohere` never falls back to OpenAI |
| Inventory API | `production-ai-config.ts` → `GET /api/v1/ai/production-config` |
| Persistence | `apps/api` `AiChatService` |

## API (no secrets)

```http
GET /api/v1/ai/production-config
GET /api/v1/ai/runtime
GET /api/v1/ai/health
GET /api/v1/ai/agents
GET /api/v1/ai/gateway
```

## Pin a prompt version

```dotenv
AI_PROMPT_VERSION=1.0.0
# or
AI_PROMPT_VERSION=tradeops-system@1.0.0
```

## Do not

- Put production system prompts only in Cohere Playground
- Expose `COHERE_API_KEY` as `NEXT_PUBLIC_*`
- Invent operational facts when tools return empty
- Auto-enable simulation after provider failure
