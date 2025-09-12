// app/api/analytics/test/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { startOfDay, subDays } from "date-fns";

const prisma = new PrismaClient();

export async function GET() {
  try {
    // Check what data exists
    const summaryCount = await prisma.analyticsSummary.count();
    const eventCount = await prisma.analytics.count();

    // Get date range of existing data
    const earliestSummary = await prisma.analyticsSummary.findFirst({
      orderBy: { date: "asc" },
    });

    const latestSummary = await prisma.analyticsSummary.findFirst({
      orderBy: { date: "desc" },
    });

    return NextResponse.json({
      status: "Current data status",
      summaries: {
        count: summaryCount,
        earliest: earliestSummary?.date,
        latest: latestSummary?.date,
      },
      events: {
        count: eventCount,
      },
    });
  } catch (error) {
    console.error("Test route error:", error);
    return NextResponse.json(
      { error: "Failed to check data" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { days = 7 } = await request.json().catch(() => ({ days: 7 }));

    console.log(`Creating test data for the last ${days} days...`);

    // Create test data for multiple days
    const testData = [];

    for (let i = 0; i < days; i++) {
      const date = startOfDay(subDays(new Date(), i));

      // Random data for each day
      const sessions = Math.floor(Math.random() * 20) + 5;
      const messagesPerSession = Math.floor(Math.random() * 10) + 3;
      const totalMessages = sessions * messagesPerSession;
      const completed = Math.floor(sessions * (Math.random() * 0.5 + 0.3));

      // Check if summary already exists for this date
      const existing = await prisma.analyticsSummary.findUnique({
        where: { date },
      });

      if (!existing) {
        const summary = await prisma.analyticsSummary.create({
          data: {
            date,
            totalSessions: sessions,
            totalMessages,
            avgMessagesPerSession: messagesPerSession,
            uniqueSessions: sessions,
            completedSessions: completed,
            quickActionClicks: {
              "I can't log in": Math.floor(Math.random() * sessions * 0.4),
              "I forgot my username": Math.floor(
                Math.random() * sessions * 0.3
              ),
              "I forgot my password": Math.floor(
                Math.random() * sessions * 0.2
              ),
              "Check email in system": Math.floor(
                Math.random() * sessions * 0.1
              ),
            },
          },
        });

        testData.push(summary);

        // Also create some raw events for this day
        for (let j = 0; j < sessions; j++) {
          const sessionId = `test-session-${date.getTime()}-${j}`;

          await prisma.analytics.create({
            data: {
              sessionId,
              eventType: "session_start",
              timestamp: new Date(date.getTime() + j * 1000 * 60 * 5), // Space out by 5 minutes
              eventData: {},
            },
          });

          // Add some messages
          for (let k = 0; k < messagesPerSession; k++) {
            await prisma.analytics.create({
              data: {
                sessionId,
                eventType: k % 2 === 0 ? "message_sent" : "message_received",
                timestamp: new Date(
                  date.getTime() + j * 1000 * 60 * 5 + k * 1000 * 30
                ),
                messageCount: k + 1,
                eventData: {},
              },
            });
          }

          // Mark some as completed
          if (j < completed) {
            await prisma.analytics.create({
              data: {
                sessionId,
                eventType: "session_completed",
                timestamp: new Date(
                  date.getTime() +
                    j * 1000 * 60 * 5 +
                    messagesPerSession * 1000 * 30
                ),
                eventData: {},
              },
            });
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Created test data for ${days} days`,
      daysCreated: testData.length,
      summaries: testData.map(s => ({
        date: s.date,
        sessions: s.totalSessions,
        messages: s.totalMessages,
      })),
    });
  } catch (error) {
    console.error("Error creating test data:", error);
    return NextResponse.json(
      { error: "Failed to create test data" },
      { status: 500 }
    );
  }
}

// DELETE method to clean up test data
export async function DELETE() {
  try {
    // Delete all test data (be careful!)
    const analyticsDeleted = await prisma.analytics.deleteMany({
      where: {
        sessionId: {
          startsWith: "test-session-",
        },
      },
    });

    // Optionally delete all summaries (uncomment if needed)
    // const summariesDeleted = await prisma.analyticsSummary.deleteMany({});

    return NextResponse.json({
      success: true,
      message: "Test data deleted",
      analyticsDeleted: analyticsDeleted.count,
    });
  } catch (error) {
    console.error("Error deleting test data:", error);
    return NextResponse.json(
      { error: "Failed to delete test data" },
      { status: 500 }
    );
  }
}
