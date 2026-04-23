import { NextRequest } from "next/server";

function firstHeaderValue(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const first = value.split(",")[0]?.trim();
  return first || null;
}

export function isTrustedMutationOrigin(request: NextRequest): boolean {
  const expectedOrigin = appUrl(request, "/").origin;
  const originHeader = firstHeaderValue(request.headers.get("origin"));
  if (originHeader) {
    return originHeader === expectedOrigin;
  }

  const refererHeader = firstHeaderValue(request.headers.get("referer"));
  if (refererHeader) {
    try {
      return new URL(refererHeader).origin === expectedOrigin;
    } catch {
      return false;
    }
  }

  return false;
}

export function appUrl(request: NextRequest, pathname: string): URL {
  const originHeader = firstHeaderValue(request.headers.get("origin"));
  if (originHeader) {
    return new URL(pathname, originHeader);
  }

  const refererHeader = firstHeaderValue(request.headers.get("referer"));
  if (refererHeader) {
    try {
      return new URL(pathname, new URL(refererHeader).origin);
    } catch {
      // Fall through to host-based construction below.
    }
  }

  const protocol =
    firstHeaderValue(request.headers.get("x-forwarded-proto")) ??
    request.nextUrl.protocol.replace(":", "") ??
    "http";
  const host =
    firstHeaderValue(request.headers.get("x-forwarded-host")) ??
    firstHeaderValue(request.headers.get("host")) ??
    request.nextUrl.host;

  return new URL(pathname, `${protocol}://${host}`);
}
