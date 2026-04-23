import { NextRequest, NextResponse } from "next/server";
import { validateAdminMutationRequest } from "@/lib/admin-csrf";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin-session";
import { appUrl } from "@/lib/request-origin";
import { cookies } from "next/headers";
import { getAdminSession } from "@/lib/admin-session";

export async function POST(request: NextRequest) {
  const cookieStore = cookies();
  const adminSession = getAdminSession(cookieStore);
  const redirectUrl = appUrl(request, "/admin");
  redirectUrl.searchParams.set("logged_out", "1");
  const formData = await request.formData();
  const csrfError = validateAdminMutationRequest(
    request,
    adminSession,
    String(formData.get("csrf_token") ?? "").trim() || undefined
  );
  if (csrfError) {
    redirectUrl.searchParams.set("error", csrfError);
    return NextResponse.redirect(redirectUrl, 303);
  }
  const response = NextResponse.redirect(redirectUrl, 303);
  response.cookies.delete(ADMIN_SESSION_COOKIE);
  return response;
}
