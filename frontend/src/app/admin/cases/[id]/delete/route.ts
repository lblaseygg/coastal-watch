import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { deleteAdminManualCase } from "@/lib/admin-api";
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
  const redirectUrl = appUrl(request, "/admin");
  const formData = await request.formData();
  const csrfError = validateAdminMutationRequest(
    request,
    adminSession,
    String(formData.get("csrf_token") ?? "").trim() || undefined
  );

  if (!actor) {
    redirectUrl.searchParams.set("error", "session_expired");
    return NextResponse.redirect(redirectUrl, 303);
  }

  if (csrfError) {
    redirectUrl.searchParams.set("error", csrfError);
    return NextResponse.redirect(redirectUrl, 303);
  }

  try {
    await deleteAdminManualCase(actor, params.id);
    redirectUrl.searchParams.set("success", "manual_case_deleted");
  } catch (error) {
    redirectUrl.searchParams.set(
      "error",
      error instanceof Error ? error.message : "Unable to delete manual case"
    );
  }

  return NextResponse.redirect(redirectUrl, 303);
}
