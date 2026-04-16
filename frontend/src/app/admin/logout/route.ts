import { NextRequest, NextResponse } from "next/server";
import { ADMIN_ACTOR_COOKIE, ADMIN_TOKEN_COOKIE } from "@/lib/admin-session";

export async function POST(request: NextRequest) {
  const redirectUrl = new URL("/admin", request.url);
  redirectUrl.searchParams.set("logged_out", "1");
  const response = NextResponse.redirect(redirectUrl);
  response.cookies.delete(ADMIN_TOKEN_COOKIE);
  response.cookies.delete(ADMIN_ACTOR_COOKIE);
  return response;
}
