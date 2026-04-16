import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/admin-api";
import { ADMIN_ACTOR_COOKIE, ADMIN_COOKIE_MAX_AGE, ADMIN_TOKEN_COOKIE } from "@/lib/admin-session";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const token = String(formData.get("token") ?? "").trim();
  const actor = String(formData.get("actor") ?? "").trim();
  const redirectUrl = new URL("/admin", request.url);

  if (!token || !actor) {
    redirectUrl.searchParams.set("error", "missing_credentials");
    return NextResponse.redirect(redirectUrl);
  }

  const isValid = await verifyAdminSession(token, actor);
  if (!isValid) {
    redirectUrl.searchParams.set("error", "invalid_credentials");
    return NextResponse.redirect(redirectUrl);
  }

  const response = NextResponse.redirect(redirectUrl);
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
