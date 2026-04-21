import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/admin-api";
import { adminLoginRateLimiter, clientIpFromRequest } from "@/lib/rate-limit";
import { ADMIN_ACTOR_COOKIE, ADMIN_COOKIE_MAX_AGE, ADMIN_TOKEN_COOKIE } from "@/lib/admin-session";
import { appUrl } from "@/lib/request-origin";

export async function POST(request: NextRequest) {
  const clientIp = clientIpFromRequest(request);
  const formData = await request.formData();
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

  const isValid = await verifyAdminSession(token, actor);
  if (!isValid) {
    redirectUrl.searchParams.set("error", "invalid_credentials");
    return NextResponse.redirect(redirectUrl, 303);
  }

  const response = NextResponse.redirect(redirectUrl, 303);
  response.cookies.set(ADMIN_TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_COOKIE_MAX_AGE
  });
  response.cookies.set(ADMIN_ACTOR_COOKIE, actor, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_COOKIE_MAX_AGE
  });

  return response;
}
