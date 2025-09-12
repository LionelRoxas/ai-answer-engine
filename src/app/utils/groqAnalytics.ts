// app/lib/groqAnalytics.ts
import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

interface AnalyticsSummaryData {
  dateRange: {
    start: string;
    end: string;
  };
  summary: {
    totalSessions: number;
    uniqueSessions: number;
    totalMessages: number;
    avgMessagesPerSession: number;
    completedSessions: number;
    completionRate: number;
  };
  quickActions: Record<string, number>;
  eventTypes: Record<string, number>;
}

// Helper function to format dates in HST
function formatDateHST(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      timeZone: "Pacific/Honolulu",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateString;
  }
}

export async function generateAnalyticsSummary(
  data: AnalyticsSummaryData
): Promise<string | null> {
  try {
    // Format dates in HST for the AI summary
    const startDateHST = formatDateHST(data.dateRange.start);
    const endDateHST = formatDateHST(data.dateRange.end);

    const prompt = `
You are an analytics expert for a university portal support system. Generate a concise, insightful one-paragraph summary of the following analytics data. Focus on key trends, notable patterns, and actionable insights. Keep the tone professional but accessible.

Analytics Data:
- Date Range: ${startDateHST} to ${endDateHST} (Hawaii Standard Time)
- Total Sessions: ${data.summary.totalSessions}
- Unique Sessions: ${data.summary.uniqueSessions}
- Total Messages Exchanged: ${data.summary.totalMessages}
- Average Messages per Session: ${data.summary.avgMessagesPerSession.toFixed(1)}
- Completed Sessions: ${data.summary.completedSessions}
- Completion Rate: ${data.summary.completionRate.toFixed(1)}%

Quick Action Usage:
${
  Object.entries(data.quickActions)
    .map(([action, count]) => `- ${action}: ${count} clicks`)
    .join("\n") || "No quick actions recorded"
}

Event Distribution:
${
  Object.entries(data.eventTypes)
    .map(([type, count]) => `- ${type}: ${count} occurrences`)
    .join("\n") || "No events recorded"
}

IMPORTANT CONTEXT: A low or zero completion rate doesn't necessarily indicate problems. Users may have found their answer early in the conversation and resolved their issue without needing to complete the full support flow. This is actually a positive sign of efficient problem-solving. Only interpret low completion as negative if paired with very high message counts per session (indicating struggle) or repeat sessions from the same users.

Generate a single paragraph summary (4-6 sentences) that highlights the most important insights and trends from this data. Focus on user engagement, support effectiveness, and any notable patterns. Consider that users leaving early might mean they got their answer quickly. Do not use bullet points or numbered lists.`;

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content:
            "You are an analytics expert who provides clear, insightful summaries of support system data. Keep responses concise and focused on actionable insights. Remember that in a support context, users finding answers quickly and leaving (resulting in 'incomplete' sessions) can be a positive outcome. All dates and times mentioned are in Hawaii Standard Time (HST).",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error("Groq Analytics API error:", error);
    return null;
  }
}
