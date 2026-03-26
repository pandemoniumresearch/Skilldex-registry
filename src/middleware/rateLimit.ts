import type { MiddlewareHandler } from "hono";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  max: number;
  /** Window duration in milliseconds */
  windowMs: number;
  /** Key extractor — defaults to IP-based */
  keyExtractor?: (c: any) => string;
}

/**
 * In-memory rate limiter for MVP.
 * Replace with Upstash Redis for production multi-instance deployments.
 */
export function rateLimit(config: RateLimitConfig): MiddlewareHandler {
  const store = new Map<string, RateLimitEntry>();

  // Periodic cleanup every 60 seconds
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.resetAt <= now) {
        store.delete(key);
      }
    }
  }, 60_000).unref();

  return async (c, next) => {
    const key = config.keyExtractor
      ? config.keyExtractor(c)
      : c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip") ?? "unknown";

    const now = Date.now();
    let entry = store.get(key);

    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + config.windowMs };
      store.set(key, entry);
    }

    entry.count++;

    c.header("X-RateLimit-Limit", String(config.max));
    c.header("X-RateLimit-Remaining", String(Math.max(0, config.max - entry.count)));
    c.header("X-RateLimit-Reset", String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > config.max) {
      return c.json(
        { error: "Too many requests", code: "RATE_LIMITED" },
        429
      );
    }

    await next();
  };
}
