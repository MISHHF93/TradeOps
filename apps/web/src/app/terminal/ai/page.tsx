import { redirect } from 'next/navigation';

type Props = { searchParams: Promise<{ caseId?: string; objective?: string }> };

/**
 * Legacy full-page AI Operator — redirects to Objectives history.
 * Universal AI lives in the persistent right rail (AiContextPanel).
 * Long-form results: /terminal/objectives/[id]
 */
export default async function AiWorkspacePage({ searchParams }: Props) {
  const sp = await searchParams;
  const params = new URLSearchParams();
  if (sp.caseId?.trim()) params.set('caseId', sp.caseId.trim());
  if (sp.objective?.trim()) params.set('objective', sp.objective.trim());
  const q = params.toString();
  redirect(q ? `/terminal/objectives?${q}` : '/terminal/objectives');
}
