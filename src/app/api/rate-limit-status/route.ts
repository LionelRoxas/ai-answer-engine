import { NextResponse } from "next/server";

export async function GET() {
  // This endpoint just triggers the middleware to return current rate limit headers
  // The actual rate limiting logic happens in middleware.ts
  return NextResponse.json({ status: "ok" });
}
