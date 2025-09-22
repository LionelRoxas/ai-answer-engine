import { NextRequest, NextResponse } from "next/server";
import { generateAnalyticsSummary } from "@/app/utils/groqAnalytics";

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    // Extract filter type from request
    const { filter, ...analyticsData } = data;

    // Pass both analytics data and filter type
    const summary = await generateAnalyticsSummary(analyticsData, filter);

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