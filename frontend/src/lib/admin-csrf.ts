import "server-only";

import { NextRequest } from "next/server";

import { AdminSession, validateAdminCsrfToken, validateLoginCsrfToken } from "@/lib/admin-session";
import { isTrustedMutationOrigin } from "@/lib/request-origin";

export function validateLoginMutationRequest(
  request: NextRequest,
  csrfToken: string | undefined
): string | null {
  if (!isTrustedMutationOrigin(request)) {
    return "Invalid request origin.";
  }

  if (!validateLoginCsrfToken(csrfToken)) {
    return "Invalid CSRF token.";
  }

  return null;
}

export function validateAdminMutationRequest(
  request: NextRequest,
  session: AdminSession | null,
  csrfToken: string | undefined
): string | null {
  if (!session) {
    return "session_expired";
  }

  if (!isTrustedMutationOrigin(request)) {
    return "Invalid request origin.";
  }

  if (!validateAdminCsrfToken(session, csrfToken)) {
    return "Invalid CSRF token.";
  }

  return null;
}
