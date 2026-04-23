import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { updateAdminReviewItemContent } from "@/lib/admin-api";
import { validateAdminMutationRequest } from "@/lib/admin-csrf";
import { getAdminSession } from "@/lib/admin-session";
import { appUrl } from "@/lib/request-origin";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const cookieStore = cookies();
  const adminSession = getAdminSession(cookieStore);
  const actor = adminSession?.actor;
  const redirectUrl = appUrl(request, `/admin/review/${params.id}/edit`);

  if (!actor) {
    redirectUrl.searchParams.set("error", "session_expired");
    return NextResponse.redirect(redirectUrl, 303);
  }

  const formData = await request.formData();
  const title = String(formData.get("title") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();
  const sourceUrl = String(formData.get("source_url") ?? "").trim();
  const sourceTitle = String(formData.get("source_title") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const municipalityIds = formData
    .getAll("municipality_ids")
    .map((value) => String(value).trim())
    .filter(Boolean);
  const csrfError = validateAdminMutationRequest(
    request,
    adminSession,
    String(formData.get("csrf_token") ?? "").trim() || undefined
  );

  if (csrfError) {
    redirectUrl.searchParams.set("error", csrfError);
    return NextResponse.redirect(redirectUrl, 303);
  }

  if (!title || !summary || !sourceUrl || !sourceTitle || !category || municipalityIds.length === 0) {
    redirectUrl.searchParams.set("error", "Complete all automated case fields before saving.");
    return NextResponse.redirect(redirectUrl, 303);
  }

  try {
    await updateAdminReviewItemContent(actor, params.id, {
      title,
      summary,
      source_url: sourceUrl,
      source_title: sourceTitle,
      municipality_ids: municipalityIds,
      category
    });
    redirectUrl.searchParams.set("success", "automated_case_updated");
  } catch (error) {
    redirectUrl.searchParams.set(
      "error",
      error instanceof Error ? error.message : "Unable to update automated case"
    );
  }

  return NextResponse.redirect(redirectUrl, 303);
}
