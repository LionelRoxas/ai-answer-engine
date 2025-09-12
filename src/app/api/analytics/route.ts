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
  subDays,
  subWeeks,
  subMonths,
  subYears,
  format,
} from "date-fns";
import { toZonedTime, fromZonedTime, formatInTimeZone } from "date-fns-tz";

const prisma = new PrismaClient();

// Hawaii timezone constant
const HST_TIMEZONE = "Pacific/Honolulu";

interface AnalyticsEvent {
  sessionId: string;
  eventType: string;
  eventData?: any;
  quickActionType?: string;
  messageCount?: number;
}

interface AnalyticsQuery {
  filter: "day" | "week" | "month" | "year" | "custom";
  startDate?: string;
  endDate?: string;
  period?: "current" | "last" | "all";
}

export async function POST(request: NextRequest) {
  try {
    const event: AnalyticsEvent = await request.json();

    // Get current time in HST
    const now = new Date();
    const nowHST = toZonedTime(now, HST_TIMEZONE);

    // Get start of day in HST, then convert to UTC for storage
    const todayStartHST = startOfDay(nowHST);
    const todayStartUTC = fromZonedTime(todayStartHST, HST_TIMEZONE);

    // Log for debugging
    console.log(`Recording analytics:`);
    console.log(
      `  Current HST: ${formatInTimeZone(nowHST, HST_TIMEZONE, "yyyy-MM-dd HH:mm:ss zzz")}`
    );
    console.log(
      `  Today Start HST: ${formatInTimeZone(todayStartHST, HST_TIMEZONE, "yyyy-MM-dd HH:mm:ss zzz")}`
    );
    console.log(`  Storing as UTC: ${todayStartUTC.toISOString()}`);

    // Record the analytics event
    const result = await prisma.analytics.create({
      data: {
        sessionId: event.sessionId,
        eventType: event.eventType,
        eventData: event.eventData || null,
        quickActionType: event.quickActionType || null,
        messageCount: event.messageCount || 0,
        timestamp: now, // Store actual timestamp
      },
    });

    // Get or create daily summary
    let summary = await prisma.analyticsSummary.findUnique({
      where: { date: todayStartUTC },
    });

    if (!summary) {
      console.log(
        `Creating new summary for date: ${todayStartUTC.toISOString()}`
      );
      summary = await prisma.analyticsSummary.create({
        data: {
          date: todayStartUTC,
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
      const currentClicks = (summary.quickActionClicks as any) || {};
      currentClicks[event.quickActionType] =
        (currentClicks[event.quickActionType] || 0) + 1;
      updates.quickActionClicks = currentClicks;
    } else if (event.eventType === "session_completed") {
      updates.completedSessions = { increment: 1 };
    }

    // Update average messages per session
    if (updates.totalMessages || updates.totalSessions) {
      const updatedSummary = await prisma.analyticsSummary.findUnique({
        where: { date: todayStartUTC },
      });
      if (updatedSummary && updatedSummary.totalSessions > 0) {
        updates.avgMessagesPerSession =
          updatedSummary.totalMessages / updatedSummary.totalSessions;
      }
    }

    if (Object.keys(updates).length > 0) {
      await prisma.analyticsSummary.update({
        where: { date: todayStartUTC },
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
    const filter =
      (searchParams.get("filter") as AnalyticsQuery["filter"]) || "day";
    const period =
      (searchParams.get("period") as AnalyticsQuery["period"]) || "current";

    // Get current time in HST
    const now = new Date();
    const nowHST = toZonedTime(now, HST_TIMEZONE);

    let startDateHST: Date;
    let endDateHST: Date;

    // Determine date range based on filter and period
    switch (filter) {
      case "day":
        if (period === "current") {
          // Today
          startDateHST = startOfDay(nowHST);
          endDateHST = endOfDay(nowHST);
        } else if (period === "last") {
          // Yesterday
          const yesterdayHST = subDays(nowHST, 1);
          startDateHST = startOfDay(yesterdayHST);
          endDateHST = endOfDay(yesterdayHST);
        } else {
          // All time (last 30 days)
          const thirtyDaysAgoHST = subDays(nowHST, 30);
          startDateHST = startOfDay(thirtyDaysAgoHST);
          endDateHST = endOfDay(nowHST);
        }
        break;
      case "week":
        if (period === "current") {
          startDateHST = startOfWeek(nowHST);
          endDateHST = endOfWeek(nowHST);
        } else if (period === "last") {
          const lastWeekHST = subWeeks(nowHST, 1);
          startDateHST = startOfWeek(lastWeekHST);
          endDateHST = endOfWeek(lastWeekHST);
        } else {
          const twelveWeeksAgoHST = subWeeks(nowHST, 12);
          startDateHST = startOfWeek(twelveWeeksAgoHST);
          endDateHST = endOfWeek(nowHST);
        }
        break;
      case "month":
        if (period === "current") {
          startDateHST = startOfMonth(nowHST);
          endDateHST = endOfMonth(nowHST);
        } else if (period === "last") {
          const lastMonthHST = subMonths(nowHST, 1);
          startDateHST = startOfMonth(lastMonthHST);
          endDateHST = endOfMonth(lastMonthHST);
        } else {
          const twelveMonthsAgoHST = subMonths(nowHST, 12);
          startDateHST = startOfMonth(twelveMonthsAgoHST);
          endDateHST = endOfMonth(nowHST);
        }
        break;
      case "year":
        if (period === "current") {
          startDateHST = startOfYear(nowHST);
          endDateHST = endOfYear(nowHST);
        } else if (period === "last") {
          const lastYearHST = subYears(nowHST, 1);
          startDateHST = startOfYear(lastYearHST);
          endDateHST = endOfYear(lastYearHST);
        } else {
          const fiveYearsAgoHST = subYears(nowHST, 5);
          startDateHST = startOfYear(fiveYearsAgoHST);
          endDateHST = endOfYear(nowHST);
        }
        break;
      default:
        startDateHST = startOfDay(nowHST);
        endDateHST = endOfDay(nowHST);
    }

    // Convert HST dates to UTC for database query
    const startDateUTC = fromZonedTime(startDateHST, HST_TIMEZONE);
    const endDateUTC = fromZonedTime(endDateHST, HST_TIMEZONE);

    // Log for debugging
    console.log(`\n=== Analytics Query Debug ===`);
    console.log(`Filter: ${filter}, Period: ${period}`);
    console.log(
      `Current HST: ${formatInTimeZone(nowHST, HST_TIMEZONE, "yyyy-MM-dd HH:mm:ss zzz")}`
    );
    console.log(
      `Start HST: ${formatInTimeZone(startDateHST, HST_TIMEZONE, "yyyy-MM-dd HH:mm:ss zzz")}`
    );
    console.log(
      `End HST: ${formatInTimeZone(endDateHST, HST_TIMEZONE, "yyyy-MM-dd HH:mm:ss zzz")}`
    );
    console.log(`Start UTC: ${startDateUTC.toISOString()}`);
    console.log(`End UTC: ${endDateUTC.toISOString()}`);

    // Fetch analytics summaries
    const summaries = await prisma.analyticsSummary.findMany({
      where: {
        date: {
          gte: startDateUTC,
          lte: endDateUTC,
        },
      },
      orderBy: { date: "asc" },
    });

    console.log(`Found ${summaries.length} summaries`);
    summaries.forEach(s => {
      const summaryHST = toZonedTime(s.date, HST_TIMEZONE);
      console.log(
        `  - ${format(summaryHST, "yyyy-MM-dd")} HST: ${s.totalSessions} sessions, ${s.totalMessages} messages`
      );
    });

    // Fetch raw analytics data
    const rawAnalytics = await prisma.analytics.findMany({
      where: {
        timestamp: {
          gte: startDateUTC,
          lte: endDateUTC,
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

    const response = {
      dateRange: {
        start: startDateUTC.toISOString(),
        end: endDateUTC.toISOString(),
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
      currentTimeHST: formatInTimeZone(
        nowHST,
        HST_TIMEZONE,
        "yyyy-MM-dd HH:mm:ss zzz"
      ),
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
