import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { createAdminManualCase } from "@/lib/admin-api";
import { ADMIN_ACTOR_COOKIE, ADMIN_TOKEN_COOKIE } from "@/lib/admin-session";
import { appUrl } from "@/lib/request-origin";

function toIsoDate(dateValue: string): string {
  return `${dateValue}T00:00:00+00:00`;
}

export async function POST(request: NextRequest) {
  const cookieStore = cookies();
  const token = cookieStore.get(ADMIN_TOKEN_COOKIE)?.value;
  const actor = cookieStore.get(ADMIN_ACTOR_COOKIE)?.value;
  const redirectUrl = appUrl(request, "/admin");

  if (!token || !actor) {
    redirectUrl.searchParams.set("error", "session_expired");
    return NextResponse.redirect(redirectUrl, 303);
  }

  const formData = await request.formData();
  const title = String(formData.get("title") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();
  const sourceUrl = String(formData.get("source_url") ?? "").trim();
  const sourceTitle = String(formData.get("source_title") ?? "").trim();
  const municipalityId = String(formData.get("municipality_id") ?? "").trim();
  const firstReportedAt = String(formData.get("first_reported_at") ?? "").trim();
  const lastReportedAt = String(formData.get("last_reported_at") ?? "").trim();

  if (!title || !summary || !sourceUrl || !sourceTitle || !municipalityId || !firstReportedAt) {
    redirectUrl.searchParams.set("error", "missing_manual_case_fields");
    return NextResponse.redirect(redirectUrl, 303);
  }

  try {
    await createAdminManualCase(token, actor, {
      title,
      summary,
      source_url: sourceUrl,
      source_title: sourceTitle,
      municipality_id: municipalityId,
      first_reported_at: toIsoDate(firstReportedAt),
      last_reported_at: lastReportedAt ? toIsoDate(lastReportedAt) : undefined
    });
    redirectUrl.searchParams.set("success", "manual_case_created");
  } catch (error) {
    redirectUrl.searchParams.set(
      "error",
      error instanceof Error ? error.message : "Unable to create manual case"
    );
  }

  return NextResponse.redirect(redirectUrl, 303);
}
