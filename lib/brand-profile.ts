export type BrandProfileBody = {
  company_name?: string;
  industry?: string;
  audience?: string;
  tone?: string;
  competitors?: string;
  additional_context?: string;
  [key: string]: unknown;
};

export type BrandProfileUpsertPayload = {
  user_id: string;
  workspace_id: string;
  company_name?: string;
  industry?: string;
  audience?: string;
  tone?: string;
  competitors?: string;
  additional_context?: string;
  updated_at: string;
};

export function buildBrandProfileUpsertPayload({
  userId,
  workspaceId,
  body,
  now = new Date(),
}: {
  userId: string;
  workspaceId: string;
  body: BrandProfileBody;
  now?: Date;
}): BrandProfileUpsertPayload {
  return {
    user_id: userId,
    workspace_id: workspaceId,
    company_name: body.company_name,
    industry: body.industry,
    audience: body.audience,
    tone: body.tone,
    competitors: body.competitors,
    additional_context: body.additional_context,
    updated_at: now.toISOString(),
  };
}
