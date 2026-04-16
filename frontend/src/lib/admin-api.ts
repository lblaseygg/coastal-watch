import { ADMIN_ACTOR_COOKIE, ADMIN_TOKEN_COOKIE } from "@/lib/admin-session";
import type { CaseRecord } from "@/lib/contracts";

type ApiEnvelope<T> = {
  data: T;
  meta: {
    schema_version: string;
    request_id: string;
    generated_at: string;
  };
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  } | null;
};

export type AdminAuditEventRecord = {
  action: string;
  actor_id: string;
  at: string;
  note: string | null;
  metadata?: Record<string, unknown> | null;
};

export type AdminReviewItemSummaryRecord = {
  id: string;
  entity_type: string;
  entity_id: string;
  status: string;
  reason_codes: string[];
  editable_fields: string[];
  assigned_to: string | null;
  decision_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminReviewItemDetailRecord = AdminReviewItemSummaryRecord & {
  audit_events: AdminAuditEventRecord[];
  extraction: {
    id: string;
    article_id: string;
    schema_version: string;
    relevance: string;
    confidence_score: number;
    extracted_case_title: string;
    extracted_summary: string;
    category: string;
    municipality_ids: string[];
    claims: Array<{
      text: string;
      evidence_snippet: string;
      sensitive: boolean;
    }>;
    sensitive_flags: string[];
    needs_review: boolean;
    model_name: string;
    created_at: string;
  } | null;
  article: {
    id: string;
    url: string;
    publisher: string;
    title: string;
    published_at: string;
    accessed_at: string;
    language: string;
    fetch_status: string;
    linked_case_ids: string[];
    cleaned_text: string;
  } | null;
  linked_case:
    | Pick<
        CaseRecord,
        | "id"
        | "slug"
        | "title"
        | "municipality_id"
        | "status"
        | "category"
        | "tags"
        | "public_summary"
        | "location"
        | "first_reported_at"
        | "last_updated_at"
      >
    | null;
};

function getApiBaseUrl(): string {
  return process.env.API_BASE_URL ?? "http://localhost:8000";
}

async function fetchAdminApi<T>(
  path: string,
  options: {
    token: string;
    actor: string;
    method?: string;
    body?: string;
  }
): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method: options.method ?? "GET",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${options.token}`,
      "Content-Type": "application/json",
      "X-Admin-Actor": options.actor
    },
    body: options.body
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ApiEnvelope<unknown> | null;
    const message =
      payload?.error?.message ??
      `Admin API request failed for ${path} with status ${response.status.toString()}`;
    const error = new Error(message) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }

  const payload = (await response.json()) as ApiEnvelope<T>;

  if (payload.error) {
    throw new Error(payload.error.message);
  }

  return payload.data;
}

export async function verifyAdminSession(token: string, actor: string): Promise<boolean> {
  try {
    await fetchAdminApi<{ items: AdminReviewItemSummaryRecord[] }>("/api/admin/review-items", {
      token,
      actor
    });
    return true;
  } catch {
    return false;
  }
}

export async function getAdminReviewItems(
  token: string,
  actor: string,
  status?: string
): Promise<AdminReviewItemSummaryRecord[]> {
  const searchParams = new URLSearchParams();

  if (status && status !== "all") {
    searchParams.set("status", status);
  }

  const queryString = searchParams.toString();
  const data = await fetchAdminApi<{ items: AdminReviewItemSummaryRecord[] }>(
    `/api/admin/review-items${queryString ? `?${queryString}` : ""}`,
    {
      token,
      actor
    }
  );

  return data.items;
}

export async function getAdminReviewItem(
  token: string,
  actor: string,
  itemId: string
): Promise<AdminReviewItemDetailRecord> {
  const data = await fetchAdminApi<{ item: AdminReviewItemDetailRecord }>(
    `/api/admin/review-items/${itemId}`,
    {
      token,
      actor
    }
  );

  return data.item;
}

export async function submitAdminDecision(
  token: string,
  actor: string,
  itemId: string,
  payload: {
    action: string;
    note?: string;
    assigned_to?: string;
    edits?: Record<string, unknown>;
  }
): Promise<AdminReviewItemDetailRecord> {
  const data = await fetchAdminApi<{ item: AdminReviewItemDetailRecord }>(
    `/api/admin/review-items/${itemId}/decision`,
    {
      token,
      actor,
      method: "POST",
      body: JSON.stringify(payload)
    }
  );

  return data.item;
}

export function getAdminSessionCookies() {
  return {
    token: ADMIN_TOKEN_COOKIE,
    actor: ADMIN_ACTOR_COOKIE
  };
}
