import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { updateAdminReviewItemContent } from "@/lib/admin-api";
import { ADMIN_ACTOR_COOKIE, ADMIN_TOKEN_COOKIE } from "@/lib/admin-session";
import { appUrl } from "@/lib/request-origin";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const cookieStore = cookies();
  const token = cookieStore.get(ADMIN_TOKEN_COOKIE)?.value;
  const actor = cookieStore.get(ADMIN_ACTOR_COOKIE)?.value;
  const redirectUrl = appUrl(request, `/admin/review/${params.id}/edit`);

  if (!token || !actor) {
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

  if (!title || !summary || !sourceUrl || !sourceTitle || !category || municipalityIds.length === 0) {
    redirectUrl.searchParams.set("error", "Complete all automated case fields before saving.");
    return NextResponse.redirect(redirectUrl, 303);
  }

  try {
    await updateAdminReviewItemContent(token, actor, params.id, {
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
