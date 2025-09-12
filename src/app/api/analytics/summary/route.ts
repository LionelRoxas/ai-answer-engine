// app/api/analytics/summary/route.ts
import { NextRequest, NextResponse } from "next/server";
import { generateAnalyticsSummary } from "@/app/utils/groqAnalytics";

export async function POST(request: NextRequest) {
  try {
    const analyticsData = await request.json();

    const summary = await generateAnalyticsSummary(analyticsData);

    if (!summary) {
      return NextResponse.json(
        { error: "Failed to generate summary" },
        { status: 500 }
      );
    }

    return NextResponse.json({ summary });
  } catch (error) {
    console.error("Summary generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate analytics summary" },
      { status: 500 }
    );
  }
}
