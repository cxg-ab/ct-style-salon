import { createHmac, timingSafeEqual } from "node:crypto";

const LOOKUP_WINDOW_MS = 15 * 60 * 1000;
const LOOKUP_LIMIT = 8;

const lookupAttempts = new Map<string, { count: number; resetAt: number }>();

function lookupSecret(): string {
  return (
    process.env.BOOKING_LOOKUP_SECRET ||
    process.env.SESSION_SECRET ||
    "ct-style-salon-lookup"
  );
}

export function appointmentLookupCode(email: string): string {
  return createHmac("sha256", lookupSecret())
    .update(email.trim().toLowerCase())
    .digest("hex")
    .slice(0, 6)
    .toUpperCase();
}

export function lookupCodesMatch(email: string, provided: string | undefined): boolean {
  if (!provided) return false;
  const expected = appointmentLookupCode(email);
  const received = provided.trim().toUpperCase();
  if (expected.length !== received.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

export function allowLookupAttempt(key: string): boolean {
  const now = Date.now();
  const current = lookupAttempts.get(key);
  if (!current || current.resetAt <= now) {
    lookupAttempts.set(key, { count: 1, resetAt: now + LOOKUP_WINDOW_MS });
    return true;
  }
  if (current.count >= LOOKUP_LIMIT) {
    return false;
  }
  current.count += 1;
  return true;
}

export function clientKey(req: { ip?: string; socket?: { remoteAddress?: string }; header: (name: string) => string | undefined }): string {
  return req.header("x-forwarded-for")?.split(",")[0]?.trim() || req.ip || req.socket?.remoteAddress || "unknown";
}
