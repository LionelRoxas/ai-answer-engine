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
} from "date-fns";

const prisma = new PrismaClient();

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
    const filter =
      (searchParams.get("filter") as AnalyticsQuery["filter"]) || "day";
    const period =
      (searchParams.get("period") as AnalyticsQuery["period"]) || "current";
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    let startDate: Date;
    let endDate: Date;
    const now = new Date();

    // Determine date range based on filter and period
    if (filter === "custom" && startDateParam && endDateParam) {
      startDate = new Date(startDateParam);
      endDate = new Date(endDateParam);
    } else {
      switch (filter) {
        case "day":
          if (period === "current") {
            startDate = startOfDay(now);
            endDate = endOfDay(now);
          } else if (period === "last") {
            startDate = startOfDay(subDays(now, 1));
            endDate = endOfDay(subDays(now, 1));
          } else {
            startDate = startOfDay(subDays(now, 30)); // Last 30 days
            endDate = endOfDay(now);
          }
          break;
        case "week":
          if (period === "current") {
            startDate = startOfWeek(now);
            endDate = endOfWeek(now);
          } else if (period === "last") {
            startDate = startOfWeek(subWeeks(now, 1));
            endDate = endOfWeek(subWeeks(now, 1));
          } else {
            startDate = startOfWeek(subWeeks(now, 12)); // Last 12 weeks
            endDate = endOfWeek(now);
          }
          break;
        case "month":
          if (period === "current") {
            startDate = startOfMonth(now);
            endDate = endOfMonth(now);
          } else if (period === "last") {
            startDate = startOfMonth(subMonths(now, 1));
            endDate = endOfMonth(subMonths(now, 1));
          } else {
            startDate = startOfMonth(subMonths(now, 12)); // Last 12 months
            endDate = endOfMonth(now);
          }
          break;
        case "year":
          if (period === "current") {
            startDate = startOfYear(now);
            endDate = endOfYear(now);
          } else if (period === "last") {
            startDate = startOfYear(subYears(now, 1));
            endDate = endOfYear(subYears(now, 1));
          } else {
            startDate = startOfYear(subYears(now, 5)); // Last 5 years
            endDate = endOfYear(now);
          }
          break;
        default:
          startDate = startOfDay(now);
          endDate = endOfDay(now);
      }
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
