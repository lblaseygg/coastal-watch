import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { deleteAdminManualCase } from "@/lib/admin-api";
import { ADMIN_ACTOR_COOKIE, ADMIN_TOKEN_COOKIE } from "@/lib/admin-session";
import { appUrl } from "@/lib/request-origin";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const cookieStore = cookies();
  const token = cookieStore.get(ADMIN_TOKEN_COOKIE)?.value;
  const actor = cookieStore.get(ADMIN_ACTOR_COOKIE)?.value;
  const redirectUrl = appUrl(request, "/admin");

  if (!token || !actor) {
    redirectUrl.searchParams.set("error", "session_expired");
    return NextResponse.redirect(redirectUrl, 303);
  }

  try {
    await deleteAdminManualCase(token, actor, params.id);
    redirectUrl.searchParams.set("success", "manual_case_deleted");
  } catch (error) {
    redirectUrl.searchParams.set(
      "error",
      error instanceof Error ? error.message : "Unable to delete manual case"
    );
  }

  return NextResponse.redirect(redirectUrl, 303);
}
