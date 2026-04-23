import { NextRequest, NextResponse } from "next/server";
import { adminLoginRateLimiter, clientIpFromRequest } from "@/lib/rate-limit";
import { validateLoginMutationRequest } from "@/lib/admin-csrf";
import {
  ADMIN_COOKIE_MAX_AGE,
  ADMIN_SESSION_COOKIE,
  createAdminSessionValue,
  isSubmittedAdminTokenValid
} from "@/lib/admin-session";
import { appUrl } from "@/lib/request-origin";

export async function POST(request: NextRequest) {
  const clientIp = clientIpFromRequest(request);
  const formData = await request.formData();
  const csrfToken = String(formData.get("csrf_token") ?? "").trim();
  const token = String(formData.get("token") ?? "").trim();
  const actor = String(formData.get("actor") ?? "").trim();
  const redirectUrl = appUrl(request, "/admin");

  if (!adminLoginRateLimiter.allow(clientIp)) {
    redirectUrl.searchParams.set("error", "Too many sign-in attempts. Try again later.");
    return NextResponse.redirect(redirectUrl, 303);
  }

  if (!token || !actor) {
    redirectUrl.searchParams.set("error", "missing_credentials");
    return NextResponse.redirect(redirectUrl, 303);
  }

  const csrfError = validateLoginMutationRequest(request, csrfToken || undefined);
  if (csrfError) {
    redirectUrl.searchParams.set("error", csrfError);
    return NextResponse.redirect(redirectUrl, 303);
  }

  const isValid = isSubmittedAdminTokenValid(token);
  if (!isValid) {
    redirectUrl.searchParams.set("error", "invalid_credentials");
    return NextResponse.redirect(redirectUrl, 303);
  }

  const sessionValue = createAdminSessionValue(actor);
  if (!sessionValue) {
    redirectUrl.searchParams.set("error", "Admin session is not configured.");
    return NextResponse.redirect(redirectUrl, 303);
  }

  const response = NextResponse.redirect(redirectUrl, 303);
  response.cookies.set(ADMIN_SESSION_COOKIE, sessionValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_COOKIE_MAX_AGE
  });

  return response;
}
