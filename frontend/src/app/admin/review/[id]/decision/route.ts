import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { submitAdminDecision } from "@/lib/admin-api";
import { ADMIN_ACTOR_COOKIE, ADMIN_TOKEN_COOKIE } from "@/lib/admin-session";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const cookieStore = cookies();
  const token = cookieStore.get(ADMIN_TOKEN_COOKIE)?.value;
  const actor = cookieStore.get(ADMIN_ACTOR_COOKIE)?.value;

  const redirectUrl = new URL(`/admin/review/${params.id}`, request.url);

  if (!token || !actor) {
    redirectUrl.searchParams.set("error", "session_expired");
    return NextResponse.redirect(redirectUrl);
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
    redirectUrl.searchParams.set("success", action);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save review decision";
    redirectUrl.searchParams.set("error", message);
  }

  return NextResponse.redirect(redirectUrl);
}
