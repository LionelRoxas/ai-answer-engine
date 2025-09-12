// app/utils/groqAnalytics.ts
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

export async function generateAnalyticsSummary(
  data: AnalyticsSummaryData
): Promise<string | null> {
  try {
    const prompt = `
You are an analytics expert for a university portal support system. Generate a concise, insightful one-paragraph summary of the following analytics data. Focus on key trends, notable patterns, and actionable insights. Keep the tone professional but accessible.

Analytics Data:
- Date Range: ${new Date(data.dateRange.start).toLocaleDateString()} to ${new Date(data.dateRange.end).toLocaleDateString()}
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

Generate a single paragraph summary (4-6 sentences) that highlights the most important insights and trends from this data. Focus on user engagement, support effectiveness, and any notable patterns. Do not use bullet points or numbered lists.`;

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content:
            "You are an analytics expert who provides clear, insightful summaries of support system data. Keep responses concise and focused on actionable insights.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 300,
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error("Groq Analytics API error:", error);
    return null;
  }
}
