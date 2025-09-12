/* eslint-disable @typescript-eslint/no-explicit-any */
// app/lib/analyticsTracker.ts

interface TrackEventOptions {
  sessionId: string;
  eventType:
    | "session_start"
    | "message_sent"
    | "message_received"
    | "quick_action_clicked"
    | "option_clicked"
    | "session_completed";
  eventData?: any;
  quickActionType?: string;
  messageCount?: number;
}

class AnalyticsTracker {
  private static instance: AnalyticsTracker;
  private sessionId: string | null = null;
  private messageCount: number = 0;

  private constructor() {}

  static getInstance(): AnalyticsTracker {
    if (!AnalyticsTracker.instance) {
      AnalyticsTracker.instance = new AnalyticsTracker();
    }
    return AnalyticsTracker.instance;
  }

  // Initialize a new session
  initSession(sessionId?: string): string {
    this.sessionId = sessionId || Date.now().toString();
    this.messageCount = 0;
    this.trackEvent({
      sessionId: this.sessionId,
      eventType: "session_start",
      eventData: { timestamp: new Date().toISOString() },
    });
    return this.sessionId;
  }

  // Track a generic event
  async trackEvent(options: TrackEventOptions): Promise<void> {
    try {
      const response = await fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...options,
          messageCount: options.messageCount || this.messageCount,
        }),
      });

      if (!response.ok) {
        console.error(
          "Failed to track analytics event:",
          await response.text()
        );
      }
    } catch (error) {
      console.error("Analytics tracking error:", error);
    }
  }

  // Track when a user clicks a quick action
  trackQuickAction(actionTitle: string): void {
    if (!this.sessionId) {
      this.initSession();
    }

    this.trackEvent({
      sessionId: this.sessionId!,
      eventType: "quick_action_clicked",
      quickActionType: actionTitle,
      eventData: {
        actionTitle,
        timestamp: new Date().toISOString(),
      },
    });
  }

  // Track when a message is sent
  trackMessageSent(message: string): void {
    if (!this.sessionId) {
      this.initSession();
    }

    this.messageCount++;
    this.trackEvent({
      sessionId: this.sessionId!,
      eventType: "message_sent",
      messageCount: this.messageCount,
      eventData: {
        messageLength: message.length,
        timestamp: new Date().toISOString(),
      },
    });
  }

  // Track when a message is received
  trackMessageReceived(message: string, hasOptions?: boolean): void {
    if (!this.sessionId) {
      this.initSession();
    }

    this.messageCount++;
    this.trackEvent({
      sessionId: this.sessionId!,
      eventType: "message_received",
      messageCount: this.messageCount,
      eventData: {
        messageLength: message.length,
        hasOptions,
        timestamp: new Date().toISOString(),
      },
    });
  }

  // Track when an option is clicked
  trackOptionClick(optionText: string): void {
    if (!this.sessionId) {
      this.initSession();
    }

    this.trackEvent({
      sessionId: this.sessionId!,
      eventType: "option_clicked",
      eventData: {
        optionText,
        timestamp: new Date().toISOString(),
      },
    });
  }

  // Track when a session is completed (resolved)
  trackSessionCompleted(): void {
    if (!this.sessionId) return;

    this.trackEvent({
      sessionId: this.sessionId!,
      eventType: "session_completed",
      messageCount: this.messageCount,
      eventData: {
        totalMessages: this.messageCount,
        timestamp: new Date().toISOString(),
      },
    });
  }

  // Get current session ID
  getSessionId(): string | null {
    return this.sessionId;
  }

  // Get current message count
  getMessageCount(): number {
    return this.messageCount;
  }

  // Reset the tracker
  reset(): void {
    this.sessionId = null;
    this.messageCount = 0;
  }
}

// Export a singleton instance
export const analyticsTracker = AnalyticsTracker.getInstance();
