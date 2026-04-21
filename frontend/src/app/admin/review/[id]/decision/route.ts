import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { submitAdminDecision } from "@/lib/admin-api";
import { ADMIN_ACTOR_COOKIE, ADMIN_TOKEN_COOKIE } from "@/lib/admin-session";
import { appUrl } from "@/lib/request-origin";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const cookieStore = cookies();
  const token = cookieStore.get(ADMIN_TOKEN_COOKIE)?.value;
  const actor = cookieStore.get(ADMIN_ACTOR_COOKIE)?.value;

  const redirectUrl = appUrl(request, `/admin/review/${params.id}`);
  const queueRedirectUrl = appUrl(request, "/admin");

  if (!token || !actor) {
    redirectUrl.searchParams.set("error", "session_expired");
    return NextResponse.redirect(redirectUrl, 303);
  }

  const formData = await request.formData();
  const action = String(formData.get("action") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const assignedTo = String(formData.get("assigned_to") ?? "").trim();
  const editedSummary = String(formData.get("edited_summary") ?? "").trim();

  try {
    await submitAdminDecision(token, actor, params.id, {
      action,
      note: note || undefined,
      assigned_to: assignedTo || undefined,
      edits: editedSummary ? { extracted_summary: editedSummary } : {}
    });
    queueRedirectUrl.searchParams.set("success", action);
    queueRedirectUrl.searchParams.set("status", "pending_review");
    queueRedirectUrl.searchParams.set("refresh", Date.now().toString());
    return NextResponse.redirect(queueRedirectUrl, 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save review decision";
    redirectUrl.searchParams.set("error", message);
    redirectUrl.searchParams.set("refresh", Date.now().toString());
  }

  return NextResponse.redirect(redirectUrl, 303);
}
