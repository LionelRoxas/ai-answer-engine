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
import { toZonedTime, fromZonedTime } from "date-fns-tz";

const HST_TIMEZONE = "Pacific/Honolulu";
const prisma = new PrismaClient();

// Helper function to get current time in HST
function getNowInHST(): Date {
  return toZonedTime(new Date(), HST_TIMEZONE);
}

// Helper function to get start of day in HST
function getStartOfDayHST(date: Date = new Date()): Date {
  const hstDate = toZonedTime(date, HST_TIMEZONE);
  const startOfDayHST = startOfDay(hstDate);
  return fromZonedTime(startOfDayHST, HST_TIMEZONE);
}

// Helper function to get end of day in HST
function getEndOfDayHST(date: Date = new Date()): Date {
  const hstDate = toZonedTime(date, HST_TIMEZONE);
  const endOfDayHST = endOfDay(hstDate);
  return fromZonedTime(endOfDayHST, HST_TIMEZONE);
}

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

    // Update or create daily summary - using HST timezone
    const todayHST = getStartOfDayHST();

    // Get current summary for today
    let summary = await prisma.analyticsSummary.findUnique({
      where: { date: todayHST },
    });

    if (!summary) {
      // Create new summary for today
      summary = await prisma.analyticsSummary.create({
        data: {
          date: todayHST,
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
        where: { date: todayHST },
      });
      if (updatedSummary && updatedSummary.totalSessions > 0) {
        updates.avgMessagesPerSession =
          updatedSummary.totalMessages / updatedSummary.totalSessions;
      }
    }

    if (Object.keys(updates).length > 0) {
      await prisma.analyticsSummary.update({
        where: { date: todayHST },
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

    // Get current time in HST
    const nowHST = getNowInHST();

    // Determine date range based on filter - all in HST
    switch (filter) {
      case "day":
        // Only current day in HST
        startDate = getStartOfDayHST(nowHST);
        endDate = getEndOfDayHST(nowHST);
        break;

      case "week":
        // Current week or last week in HST
        if (weekPeriod === "current") {
          const weekStartHST = startOfWeek(nowHST, { weekStartsOn: 0 }); // Sunday
          const weekEndHST = endOfWeek(nowHST, { weekStartsOn: 0 });
          startDate = fromZonedTime(weekStartHST, HST_TIMEZONE);
          endDate = fromZonedTime(weekEndHST, HST_TIMEZONE);
        } else {
          // Last week
          const lastWeekHST = subWeeks(nowHST, 1);
          const weekStartHST = startOfWeek(lastWeekHST, { weekStartsOn: 0 });
          const weekEndHST = endOfWeek(lastWeekHST, { weekStartsOn: 0 });
          startDate = fromZonedTime(weekStartHST, HST_TIMEZONE);
          endDate = fromZonedTime(weekEndHST, HST_TIMEZONE);
        }
        break;

      case "month":
        // Specific month in HST
        const selectedMonth = month ? parseInt(month) - 1 : nowHST.getMonth();
        const selectedYear = year ? parseInt(year) : nowHST.getFullYear();
        const monthDateHST = new Date(selectedYear, selectedMonth, 1);
        const monthStartHST = startOfMonth(monthDateHST);
        const monthEndHST = endOfMonth(monthDateHST);
        startDate = fromZonedTime(monthStartHST, HST_TIMEZONE);
        endDate = fromZonedTime(monthEndHST, HST_TIMEZONE);
        break;

      case "year":
        // Specific year in HST
        const yearValue = year ? parseInt(year) : nowHST.getFullYear();
        const yearDateHST = new Date(yearValue, 0, 1);
        const yearStartHST = startOfYear(yearDateHST);
        const yearEndHST = endOfYear(new Date(yearValue, 11, 31));
        startDate = fromZonedTime(yearStartHST, HST_TIMEZONE);
        endDate = fromZonedTime(yearEndHST, HST_TIMEZONE);
        break;

      default:
        // Default to current day in HST
        startDate = getStartOfDayHST(nowHST);
        endDate = getEndOfDayHST(nowHST);
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
        start: startDate.toISOString(),
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
