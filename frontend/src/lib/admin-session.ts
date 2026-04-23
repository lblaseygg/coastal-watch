import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_SESSION_COOKIE = "coastal_watch_admin_session";
export const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 12;
export const ADMIN_ROLE = "admin" as const;

type CookieStoreLike = {
  get(name: string): { value: string } | undefined;
};

export type AdminSession = {
  actor: string;
  role: typeof ADMIN_ROLE;
  expires_at: number;
};

function toBase64Url(value: string): string {
  return Buffer.from(value, "utf-8").toString("base64url");
}

function fromBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf-8");
}

function getAdminSessionSecret(): string | null {
  return process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_API_TOKEN ?? null;
}

type SignedPayload = {
  sub: string;
  exp: number;
};

export function getServerAdminApiToken(): string | null {
  return process.env.ADMIN_API_TOKEN ?? null;
}

function signSessionPayload(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length != rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function isSubmittedAdminTokenValid(submittedToken: string): boolean {
  const configuredToken = getServerAdminApiToken();
  if (!configuredToken || !submittedToken) {
    return false;
  }

  return safeEqual(submittedToken, configuredToken);
}

export function createAdminSessionValue(actor: string): string | null {
  const secret = getAdminSessionSecret();
  if (!secret) {
    return null;
  }

  const payload: AdminSession = {
    actor: actor.slice(0, 100),
    role: ADMIN_ROLE,
    expires_at: Date.now() + ADMIN_COOKIE_MAX_AGE * 1000
  };

  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = signSessionPayload(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}


function createSignedScopedValue(subject: string, expiresAt: number): string | null {
  const secret = getAdminSessionSecret();
  if (!secret) {
    return null;
  }

  const payload: SignedPayload = {
    sub: subject,
    exp: expiresAt
  };
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = signSessionPayload(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

function parseSignedScopedValue(value: string | undefined): SignedPayload | null {
  if (!value) {
    return null;
  }

  const secret = getAdminSessionSecret();
  if (!secret) {
    return null;
  }

  const [encodedPayload, signature] = value.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = signSessionPayload(encodedPayload, secret);
  if (!safeEqual(signature, expectedSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload)) as SignedPayload;
    if (!payload.sub?.trim()) {
      return null;
    }
    if (!payload.exp || payload.exp <= Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function parseAdminSessionValue(value: string | undefined): AdminSession | null {
  if (!value) {
    return null;
  }

  const secret = getAdminSessionSecret();
  if (!secret) {
    return null;
  }

  const [encodedPayload, signature] = value.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = signSessionPayload(encodedPayload, secret);
  if (!safeEqual(signature, expectedSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload)) as AdminSession;
    if (payload.role !== ADMIN_ROLE) {
      return null;
    }
    if (!payload.actor?.trim()) {
      return null;
    }
    if (!payload.expires_at || payload.expires_at <= Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function getAdminSession(cookieStore: CookieStoreLike): AdminSession | null {
  return parseAdminSessionValue(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
}

export function getAdminCsrfSubject(session: AdminSession): string {
  return `admin:${session.role}:${session.actor}:${session.expires_at}`;
}

export function createAdminCsrfToken(session: AdminSession): string | null {
  return createSignedScopedValue(getAdminCsrfSubject(session), session.expires_at);
}

export function validateAdminCsrfToken(session: AdminSession, token: string | undefined): boolean {
  const payload = parseSignedScopedValue(token);
  if (!payload) {
    return false;
  }

  return payload.sub === getAdminCsrfSubject(session);
}

export function createLoginCsrfToken(): string | null {
  return createSignedScopedValue("login", Date.now() + 60 * 60 * 1000);
}

export function validateLoginCsrfToken(token: string | undefined): boolean {
  const payload = parseSignedScopedValue(token);
  if (!payload) {
    return false;
  }

  return payload.sub === "login";
}
