/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/analytics/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subWeeks,
} from "date-fns";

const HST_TIMEZONE = "Pacific/Honolulu";
const nowHST = new Date(
  new Date().toLocaleString("en-US", { timeZone: HST_TIMEZONE })
);

const prisma = new PrismaClient();

interface AnalyticsEvent {
  sessionId: string;
  eventType: string;
  eventData?: any;
  quickActionType?: string;
  messageCount?: number;
}

export async function POST(request: NextRequest) {
  try {
    const event: AnalyticsEvent = await request.json();

    // Record the analytics event
    const result = await prisma.analytics.create({
      data: {
        sessionId: event.sessionId,
        eventType: event.eventType,
        eventData: event.eventData || null,
        quickActionType: event.quickActionType || null,
        messageCount: event.messageCount || 0,
      },
    });

    // Update or create daily summary
    const today = startOfDay(new Date());

    // Get current summary for today
    let summary = await prisma.analyticsSummary.findUnique({
      where: { date: today },
    });

    if (!summary) {
      // Create new summary for today
      summary = await prisma.analyticsSummary.create({
        data: {
          date: today,
          totalSessions: 0,
          totalMessages: 0,
          avgMessagesPerSession: 0,
          uniqueSessions: 0,
          completedSessions: 0,
          quickActionClicks: {},
        },
      });
    }

    // Update summary based on event type
    const updates: any = {};

    if (event.eventType === "session_start") {
      updates.totalSessions = { increment: 1 };
      updates.uniqueSessions = { increment: 1 };
    } else if (
      event.eventType === "message_sent" ||
      event.eventType === "message_received"
    ) {
      updates.totalMessages = { increment: 1 };
    } else if (
      event.eventType === "quick_action_clicked" &&
      event.quickActionType
    ) {
      // Update quick action clicks
      const currentClicks = (summary.quickActionClicks as any) || {};
      currentClicks[event.quickActionType] =
        (currentClicks[event.quickActionType] || 0) + 1;
      updates.quickActionClicks = currentClicks;
    } else if (event.eventType === "session_completed") {
      updates.completedSessions = { increment: 1 };
    }

    // Calculate average messages per session
    if (updates.totalMessages || updates.totalSessions) {
      const updatedSummary = await prisma.analyticsSummary.findUnique({
        where: { date: today },
      });
      if (updatedSummary && updatedSummary.totalSessions > 0) {
        updates.avgMessagesPerSession =
          updatedSummary.totalMessages / updatedSummary.totalSessions;
      }
    }

    if (Object.keys(updates).length > 0) {
      await prisma.analyticsSummary.update({
        where: { date: today },
        data: updates,
      });
    }

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    console.error("Analytics error:", error);
    return NextResponse.json(
      { error: "Failed to record analytics" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const filter = searchParams.get("filter") || "day";
    const weekPeriod = searchParams.get("weekPeriod") || "current";
    const month = searchParams.get("month");
    const year = searchParams.get("year");

    let startDate: Date;
    let endDate: Date;
    const now = new Date();

    // Determine date range based on filter
    switch (filter) {
      case "day":
        // Only current day
        startDate = startOfDay(now);
        endDate = endOfDay(now);
        break;

      case "week":
        // Current week or last week
        if (weekPeriod === "current") {
          startDate = startOfWeek(now, { weekStartsOn: 0 }); // Sunday
          endDate = endOfWeek(now, { weekStartsOn: 0 });
        } else {
          // Last week
          const lastWeek = subWeeks(now, 1);
          startDate = startOfWeek(lastWeek, { weekStartsOn: 0 });
          endDate = endOfWeek(lastWeek, { weekStartsOn: 0 });
        }
        break;

      case "month":
        // Specific month (current year by default)
        const selectedMonth = month ? parseInt(month) - 1 : now.getMonth();
        const selectedYear = year ? parseInt(year) : now.getFullYear();
        startDate = startOfMonth(new Date(selectedYear, selectedMonth));
        endDate = endOfMonth(new Date(selectedYear, selectedMonth));
        break;

      case "year":
        // Specific year
        const yearValue = year ? parseInt(year) : now.getFullYear();
        startDate = startOfYear(new Date(yearValue, 0));
        endDate = endOfYear(new Date(yearValue, 11));
        break;

      default:
        // Default to current day
        startDate = startOfDay(now);
        endDate = endOfDay(now);
    }

    // Fetch analytics summaries
    const summaries = await prisma.analyticsSummary.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { date: "asc" },
    });

    // Fetch raw analytics data for more detailed metrics
    const rawAnalytics = await prisma.analytics.findMany({
      where: {
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { timestamp: "asc" },
    });

    // Calculate aggregate metrics
    const totalSessions = summaries.reduce(
      (sum, s) => sum + s.totalSessions,
      0
    );
    const totalMessages = summaries.reduce(
      (sum, s) => sum + s.totalMessages,
      0
    );
    const completedSessions = summaries.reduce(
      (sum, s) => sum + s.completedSessions,
      0
    );
    const avgMessagesPerSession =
      totalSessions > 0 ? totalMessages / totalSessions : 0;
    const completionRate =
      totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0;

    // Aggregate quick action clicks
    const quickActionTotals: Record<string, number> = {};
    summaries.forEach(summary => {
      const clicks = (summary.quickActionClicks as any) || {};
      Object.entries(clicks).forEach(([action, count]) => {
        quickActionTotals[action] =
          (quickActionTotals[action] || 0) + (count as number);
      });
    });

    // Get unique sessions count
    const uniqueSessionIds = new Set(rawAnalytics.map(a => a.sessionId));

    // Group analytics by event type
    const eventTypeCounts: Record<string, number> = {};
    rawAnalytics.forEach(event => {
      eventTypeCounts[event.eventType] =
        (eventTypeCounts[event.eventType] || 0) + 1;
    });

    // Get current HST time for reference
    const currentTimeHST = nowHST.toLocaleString("en-US", {
      timeZone: HST_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });

    const response = {
      dateRange: {
        start: startDate.toISOString(), // Send back the HST dates for display
        end: endDate.toISOString(),
      },
      summary: {
        totalSessions,
        uniqueSessions: uniqueSessionIds.size,
        totalMessages,
        avgMessagesPerSession: Math.round(avgMessagesPerSession * 10) / 10,
        completedSessions,
        completionRate: Math.round(completionRate * 10) / 10,
      },
      quickActions: quickActionTotals,
      eventTypes: eventTypeCounts,
      dailySummaries: summaries,
      rawDataCount: rawAnalytics.length,
      timezone: HST_TIMEZONE,
      currentTimeHST,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Analytics fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
