/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// More lenient rate limiting for a support chat application
const rateLimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(30, "60 s"), // 30 requests per minute (very generous)
  analytics: true,
});

// Even more lenient for API calls specifically
const apiRateLimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(20, "60 s"), // 20 API calls per minute
  analytics: true,
});

export async function middleware(request: NextRequest) {
  try {
    // Better IP detection for various proxy setups
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0] ??
      request.headers.get("x-real-ip") ??
      request.headers.get("cf-connecting-ip") ??
      "127.0.0.1";

    // Skip rate limiting for static assets and certain paths
    const skipPaths = [
      "/favicon.ico",
      "/robots.txt",
      "/sitemap.xml",
      "/_next/static",
      "/_next/image",
      "/images",
    ];

    const shouldSkip = skipPaths.some(path =>
      request.nextUrl.pathname.startsWith(path)
    );

    if (shouldSkip) {
      return NextResponse.next();
    }

    // Use different rate limits for API vs regular pages
    const isApiRoute = request.nextUrl.pathname.startsWith("/api/");
    const currentRateLimit = isApiRoute ? apiRateLimit : rateLimit;

    const { success, limit, reset, remaining } =
      await currentRateLimit.limit(ip);

    const response = success
      ? NextResponse.next()
      : NextResponse.json(
          {
            error: "Rate limit exceeded",
            message:
              "You're sending messages too quickly. Please wait a moment before trying again.",
            reset: reset,
            timeRemaining: Math.ceil((reset - Date.now()) / 1000),
            retryAfter: Math.ceil((reset - Date.now()) / 1000),
          },
          { status: 429 }
        );

    // Add rate limit headers
    response.headers.set("X-RateLimit-Limit", limit.toString());
    response.headers.set("X-RateLimit-Remaining", remaining.toString());
    response.headers.set("X-RateLimit-Reset", reset.toString());

    if (!success) {
      response.headers.set(
        "Retry-After",
        Math.ceil((reset - Date.now()) / 1000).toString()
      );
    }

    return response;
  } catch (error) {
    console.error("Error in middleware:", error);
    // Allow requests through if Redis is down
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    // Match all requests except static files
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|images).*)",
  ],
};
