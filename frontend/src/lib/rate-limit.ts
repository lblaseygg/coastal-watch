type Bucket = number[];

class InMemoryRateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number
  ) {}

  allow(key: string): boolean {
    if (this.maxRequests <= 0 || this.windowMs <= 0) {
      return true;
    }

    const now = Date.now();
    const cutoff = now - this.windowMs;
    const bucket = this.buckets.get(key) ?? [];
    const nextBucket = bucket.filter((timestamp) => timestamp > cutoff);

    if (nextBucket.length >= this.maxRequests) {
      this.buckets.set(key, nextBucket);
      return false;
    }

    nextBucket.push(now);
    this.buckets.set(key, nextBucket);
    return true;
  }
}

export const adminLoginRateLimiter = new InMemoryRateLimiter(8, 5 * 60 * 1000);

export function clientIpFromRequest(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }

  return request.headers.get("x-real-ip")?.trim() || "unknown";
}
