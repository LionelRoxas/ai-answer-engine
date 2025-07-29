/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// FIXED: Use fixedWindow instead of slidingWindow for predictable reset times
const rateLimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.fixedWindow(50, "60 s"), // 50 requests per 60-second fixed window
  analytics: true,
});

// Same fix for API rate limit
const apiRateLimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.fixedWindow(50, "60 s"), // 50 API calls per 60-second fixed window
  analytics: true,
});

export async function middleware(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0] ??
      request.headers.get("x-real-ip") ??
      request.headers.get("cf-connecting-ip") ??
      "127.0.0.1";

    const skipPaths = [
      "/favicon.ico",
      "/robots.txt",
      "/sitemap.xml",
      "/_next/static",
      "/_next/image",
      "/images",
      "/api/rate-limit-status", // Don't rate limit the status check endpoint
    ];

    const shouldSkip = skipPaths.some(path =>
      request.nextUrl.pathname.startsWith(path)
    );

    if (shouldSkip) {
      return NextResponse.next();
    }

    const isApiRoute = request.nextUrl.pathname.startsWith("/api/");
    const currentRateLimit = isApiRoute ? apiRateLimit : rateLimit;

    const { success, limit, reset, remaining } =
      await currentRateLimit.limit(ip);

    // Add debug logging to understand timing
    if (!success) {
      const now = Date.now();
      const timeRemaining = Math.ceil((reset - now) / 1000);
      // console.log("Rate limit hit:", {
      //   ip,
      //   reset,
      //   now,
      //   timeRemaining,
      //   resetDate: new Date(reset).toISOString(),
      //   nowDate: new Date(now).toISOString(),
      // });
    }

    const response = success
      ? NextResponse.next()
      : NextResponse.json(
          {
            error: "Rate limit exceeded",
            message:
              "You're sending messages too quickly. Please wait a moment before trying again.",
            reset: reset,
            timeRemaining: Math.max(Math.ceil((reset - Date.now()) / 1000), 1), // At least 1 second
            retryAfter: Math.max(Math.ceil((reset - Date.now()) / 1000), 1),
          },
          { status: 429 }
        );

    // ALWAYS add rate limit headers, not just on failures
    response.headers.set("X-RateLimit-Limit", limit.toString());
    response.headers.set("X-RateLimit-Remaining", remaining.toString());
    response.headers.set("X-RateLimit-Reset", reset.toString());

    if (!success) {
      const retryAfter = Math.max(Math.ceil((reset - Date.now()) / 1000), 1);
      response.headers.set("Retry-After", retryAfter.toString());
    }

    return response;
  } catch (error) {
    console.error("Error in middleware:", error);
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    // Match all requests except static files and rate limit status endpoint
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|images).*)",
  ],
};
