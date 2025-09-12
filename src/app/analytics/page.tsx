/* eslint-disable @next/next/no-img-element */
/* eslint-disable @next/next/no-html-link-for-pages */
"use client";

import { useState, useEffect, useCallback } from "react";
import React from "react";
import {
  RefreshCw,
  MessageSquare,
  MousePointerClick,
  CheckCircle,
  Calendar,
  BarChart3,
  Activity,
  Clock,
} from "lucide-react";

interface AnalyticsSummary {
  totalSessions: number;
  uniqueSessions: number;
  totalMessages: number;
  avgMessagesPerSession: number;
  completedSessions: number;
  completionRate: number;
}

interface DailySummary {
  id?: string;
  date: string;
  totalSessions: number;
  totalMessages: number;
  avgMessagesPerSession: number;
  uniqueSessions: number;
  completedSessions: number;
  quickActionClicks?: Record<string, number>;
  createdAt?: string;
  updatedAt?: string;
}

interface AnalyticsData {
  dateRange: {
    start: string;
    end: string;
  };
  summary: AnalyticsSummary;
  quickActions: Record<string, number>;
  eventTypes: Record<string, number>;
  dailySummaries: DailySummary[];
  rawDataCount?: number;
  timezone?: string;
  currentTimeHST?: string;
}

type FilterType = "day" | "week" | "month" | "year";

// Hawaii Standard Time timezone constant
const HST_TIMEZONE = "Pacific/Honolulu";

// Get current year for year filter
const currentYear = new Date().getFullYear();
const yearOptions = Array.from(
  { length: currentYear - 2024 + 1 },
  (_, i) => 2024 + i
);

// Month options
const monthOptions = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

// Timezone indicator component showing live HST time
const TimezoneIndicator = () => {
  const [currentTime, setCurrentTime] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const hstTime = new Date().toLocaleString("en-US", {
        timeZone: HST_TIMEZONE,
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
      setCurrentTime(hstTime);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm text-blue-800">
        <Clock size={16} />
        <strong>Timezone:</strong> Hawaii Standard Time (HST)
      </div>
      <div className="text-sm text-blue-600 font-mono">{currentTime}</div>
    </div>
  );
};

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>("day");
  const [weekPeriod, setWeekPeriod] = useState<"current" | "last">("current");
  const [selectedMonth, setSelectedMonth] = useState<number>(
    new Date().getMonth() + 1
  );
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [aiSummary, setAiSummary] = useState<string>("");
  const [summaryLoading, setSummaryLoading] = useState<boolean>(false);

  // Format date for display in HST
  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        timeZone: HST_TIMEZONE,
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  // Format date range for display in HST
  const formatDateRange = (): string => {
    if (!data?.dateRange) return "";

    try {
      const startDate = new Date(data.dateRange.start);
      const endDate = new Date(data.dateRange.end);

      const formatOptions: Intl.DateTimeFormatOptions = {
        timeZone: HST_TIMEZONE,
        year: "numeric",
        month: "short",
        day: "numeric",
      };

      if (filter === "day") {
        return `Today (${startDate.toLocaleDateString("en-US", formatOptions)} HST)`;
      }

      if (filter === "week") {
        const weekLabel =
          weekPeriod === "current" ? "Current Week" : "Last Week";
        return `${weekLabel}: ${startDate.toLocaleDateString("en-US", formatOptions)} - ${endDate.toLocaleDateString("en-US", formatOptions)} HST`;
      }

      if (filter === "month") {
        const monthName = monthOptions.find(
          m => m.value === selectedMonth
        )?.label;
        return `${monthName} ${new Date(data.dateRange.start).getFullYear()} HST`;
      }

      if (filter === "year") {
        return `Year ${selectedYear} HST`;
      }

      const startStr = startDate.toLocaleDateString("en-US", formatOptions);
      const endStr = endDate.toLocaleDateString("en-US", formatOptions);

      if (startStr === endStr) {
        return `${startStr} HST`;
      }

      return `${startStr} - ${endStr} HST`;
    } catch {
      return "Date range unavailable";
    }
  };

  // Generate AI summary for analytics data
  const generateSummary = useCallback(
    async (analyticsData: AnalyticsData): Promise<void> => {
      try {
        setSummaryLoading(true);
        setAiSummary("");

        const response = await fetch("/api/analytics/summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(analyticsData),
        });

        if (response.ok) {
          const result = await response.json();
          setAiSummary(result.summary || "");
        } else {
          console.error("Failed to generate AI summary");
        }
      } catch (error) {
        console.error("Error generating summary:", error);
      } finally {
        setSummaryLoading(false);
      }
    },
    []
  );

  // Build query parameters based on filter selection
  const buildQueryParams = useCallback((): string => {
    const params = new URLSearchParams();
    params.append("filter", filter);

    if (filter === "week") {
      params.append("weekPeriod", weekPeriod);
    } else if (filter === "month") {
      params.append("month", selectedMonth.toString());
      params.append("year", new Date().getFullYear().toString()); // Current year for month
    } else if (filter === "year") {
      params.append("year", selectedYear.toString());
    }

    return params.toString();
  }, [filter, weekPeriod, selectedMonth, selectedYear]);

  // Fetch analytics data based on filters
  const fetchAnalytics = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      const queryParams = buildQueryParams();
      const response = await fetch(`/api/analytics?${queryParams}`);

      if (response.ok) {
        const result: AnalyticsData = await response.json();
        setData(result);

        // Log timezone info for debugging
        if (result.currentTimeHST) {
          console.log("Server HST time:", result.currentTimeHST);
        }

        // Generate AI summary for the fetched data
        await generateSummary(result);
      } else {
        const errorText = await response.text();
        setError(errorText || "Failed to fetch analytics data");
      }
    } catch (err) {
      setError("Error loading analytics data");
      console.error("Analytics fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [buildQueryParams, generateSummary]);

  // Fetch analytics when filter or period changes
  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Campus names for footer
  const campusNames: readonly string[] = [
    "Hawaii CC",
    "Honolulu CC",
    "Kapiolani CC",
    "Kauai CC",
    "Leeward CC",
    "Maui College",
    "Windward CC",
    "PCATT",
  ];

  // Loading state
  if (loading) {
    return (
      <div className="flex h-screen bg-gradient-to-br from-amber-50 to-orange-50 text-gray-900">
        <div className="flex-1 flex flex-col">
          <header
            className="p-3 md:p-4 shadow-lg text-white border-b border-black relative"
            style={{
              background: "#CA5C13",
              backgroundImage: "url('/images/UHCC-Hawaiian-logo.png')",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "10px center",
              backgroundSize: "auto 50%",
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm"></div>
            </div>
          </header>
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="inline-flex items-center gap-2 text-amber-600 mb-4">
                <div className="w-6 h-6 border-2 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-lg font-medium">
                  Loading analytics...
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main render
  return (
    <div className="flex h-screen bg-gradient-to-br from-amber-50 to-orange-50 text-gray-900">
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header
          className="p-3 md:p-4 shadow-lg text-white border-b border-black relative"
          style={{
            background: "#CA5C13",
            backgroundImage: "url('/images/UHCC-Hawaiian-logo.png')",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "10px center",
            backgroundSize: "auto 50%",
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 md:gap-4"></div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                <BarChart3 size={16} />
                <span className="hidden sm:inline">Analytics Dashboard</span>
                <span className="sm:hidden">Analytics</span>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto bg-gradient-to-b from-amber-50/50 to-white">
          <div className="p-4 md:p-6">
            <div className="max-w-6xl mx-auto">
              {/* Title and Filter Section */}
              <div className="mb-6 md:mb-8">
                <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-4">
                  Portal Support Analytics
                </h2>

                {/* Timezone Indicator */}
                <div className="mb-4">
                  <TimezoneIndicator />
                </div>

                {/* Filter Controls */}
                <div className="bg-white rounded-lg border border-amber-200 p-4 shadow-sm">
                  <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                    <div className="flex flex-wrap gap-2 items-center">
                      {/* Main filter type */}
                      <select
                        value={filter}
                        onChange={e => setFilter(e.target.value as FilterType)}
                        className="px-3 py-2 border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                        aria-label="Time period filter"
                      >
                        <option value="day">Today</option>
                        <option value="week">Weekly</option>
                        <option value="month">Monthly</option>
                        <option value="year">Yearly</option>
                      </select>

                      {/* Week-specific filter */}
                      {filter === "week" && (
                        <select
                          value={weekPeriod}
                          onChange={e =>
                            setWeekPeriod(e.target.value as "current" | "last")
                          }
                          className="px-3 py-2 border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                          aria-label="Week selection"
                        >
                          <option value="current">Current Week</option>
                          <option value="last">Last Week</option>
                        </select>
                      )}

                      {/* Month-specific filter */}
                      {filter === "month" && (
                        <select
                          value={selectedMonth}
                          onChange={e =>
                            setSelectedMonth(Number(e.target.value))
                          }
                          className="px-3 py-2 border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                          aria-label="Month selection"
                        >
                          {monthOptions.map(month => (
                            <option key={month.value} value={month.value}>
                              {month.label}
                            </option>
                          ))}
                        </select>
                      )}

                      {/* Year-specific filter */}
                      {filter === "year" && (
                        <select
                          value={selectedYear}
                          onChange={e =>
                            setSelectedYear(Number(e.target.value))
                          }
                          className="px-3 py-2 border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                          aria-label="Year selection"
                        >
                          {yearOptions.map(year => (
                            <option key={year} value={year}>
                              {year}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-sm text-gray-600 flex items-center gap-2">
                        <Calendar size={16} />
                        <span>{formatDateRange()}</span>
                      </div>
                      <button
                        onClick={() => fetchAnalytics()}
                        className="flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors text-sm"
                        type="button"
                        aria-label="Refresh analytics data"
                      >
                        <RefreshCw size={14} />
                        Refresh
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Summary Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-8 md:mb-10">
                {/* Total Sessions Card */}
                <div className="bg-white border-2 rounded-xl p-6 md:p-8 transition-all duration-300 bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200 hover:border-blue-400 shadow-lg hover:shadow-xl hover:scale-105 group">
                  <div className="flex items-start gap-4">
                    <div className="bg-blue-100 p-3 rounded-lg group-hover:bg-blue-200 transition-colors">
                      <Activity className="text-blue-600" size={24} />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-blue-700 text-sm mb-2 uppercase tracking-wide">
                        Total Sessions
                      </h4>
                      <p className="text-3xl md:text-4xl font-bold text-blue-600 leading-none mb-1">
                        {data?.summary?.totalSessions ?? 0}
                      </p>
                      <p className="text-blue-500/70 text-xs">
                        Active user sessions
                      </p>
                    </div>
                  </div>
                </div>

                {/* Messages Exchanged Card */}
                <div className="bg-white border-2 rounded-xl p-6 md:p-8 transition-all duration-300 bg-gradient-to-br from-green-50 to-green-100/50 border-green-200 hover:border-green-400 shadow-lg hover:shadow-xl hover:scale-105 group">
                  <div className="flex items-start gap-4">
                    <div className="bg-green-100 p-3 rounded-lg group-hover:bg-green-200 transition-colors">
                      <MessageSquare className="text-green-600" size={24} />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-green-700 text-sm mb-2 uppercase tracking-wide">
                        Messages Exchanged
                      </h4>
                      <p className="text-3xl md:text-4xl font-bold text-green-600 leading-none mb-1">
                        {data?.summary?.totalMessages ?? 0}
                      </p>
                      <p className="text-green-500/70 text-xs">
                        {data?.summary?.avgMessagesPerSession?.toFixed(1) ??
                          "0.0"}{" "}
                        per session
                      </p>
                    </div>
                  </div>
                </div>

                {/* Completed Sessions Card */}
                <div className="bg-white border-2 rounded-xl p-6 md:p-8 transition-all duration-300 bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-200 hover:border-amber-400 shadow-lg hover:shadow-xl hover:scale-105 group">
                  <div className="flex items-start gap-4">
                    <div className="bg-amber-100 p-3 rounded-lg group-hover:bg-amber-200 transition-colors">
                      <CheckCircle className="text-amber-600" size={24} />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-amber-700 text-sm mb-2 uppercase tracking-wide">
                        Completed Sessions
                      </h4>
                      <p className="text-3xl md:text-4xl font-bold text-amber-600 leading-none mb-1">
                        {data?.summary?.completedSessions ?? 0}
                      </p>
                      <p className="text-amber-500/70 text-xs">
                        {data?.summary?.completionRate?.toFixed(1) ?? "0.0"}%
                        rate
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Actions Usage */}
              {data?.quickActions &&
                Object.keys(data.quickActions).length > 0 && (
                  <div className="bg-white rounded-lg border border-amber-200 p-4 md:p-6 shadow-sm mb-6 md:mb-8">
                    <h3 className="text-base md:text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                      <MousePointerClick size={20} />
                      Quick Action Usage
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.entries(data.quickActions).map(
                        ([action, count]) => (
                          <div
                            key={action}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                          >
                            <span className="text-sm text-gray-700 truncate mr-2">
                              {action.length > 50
                                ? `${action.substring(0, 50)}...`
                                : action}
                            </span>
                            <span className="font-semibold text-amber-600">
                              {count} {count === 1 ? "click" : "clicks"}
                            </span>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}

              {/* Daily Activity Timeline */}
              {data?.dailySummaries && data.dailySummaries.length > 0 && (
                <div className="bg-white rounded-lg border border-amber-200 p-4 md:p-6 shadow-sm mb-6 md:mb-8">
                  <h3 className="text-base md:text-lg font-semibold text-gray-800 mb-4">
                    Activity Timeline (HST)
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2 px-2">Date</th>
                          <th className="text-center py-2 px-2">Sessions</th>
                          <th className="text-center py-2 px-2">Messages</th>
                          <th className="text-center py-2 px-2">Avg Msgs</th>
                          <th className="text-center py-2 px-2">Completed</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.dailySummaries.map((day, index) => (
                          <tr
                            key={day.id || `day-${index}`}
                            className="border-b border-gray-100 hover:bg-gray-50"
                          >
                            <td className="py-2 px-2">
                              {formatDate(day.date)}
                            </td>
                            <td className="text-center py-2 px-2 font-medium">
                              {day.totalSessions}
                            </td>
                            <td className="text-center py-2 px-2">
                              {day.totalMessages}
                            </td>
                            <td className="text-center py-2 px-2">
                              {day.avgMessagesPerSession.toFixed(1)}
                            </td>
                            <td className="text-center py-2 px-2">
                              <span className="text-green-600 font-medium">
                                {day.completedSessions}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Event Types Distribution */}
              {data?.eventTypes && Object.keys(data.eventTypes).length > 0 && (
                <div className="bg-white rounded-lg border border-amber-200 p-4 md:p-6 shadow-sm mb-6 md:mb-8">
                  <h3 className="text-base md:text-lg font-semibold text-gray-800 mb-4">
                    Event Distribution
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-3">
                    {Object.entries(data.eventTypes)
                      .filter(
                        ([type]) =>
                          type !== "session_start" &&
                          type !== "quick_action_clicked" &&
                          type !== "session_completed"
                      )
                      .map(([type, count]) => (
                        <div
                          key={type}
                          className="text-center p-3 bg-gray-50 rounded-lg"
                        >
                          <p className="text-xs text-gray-600 mb-1">
                            {type
                              .replace(/_/g, " ")
                              .replace(/\b\w/g, l => l.toUpperCase())}
                          </p>
                          <p className="text-lg font-bold text-gray-800">
                            {count}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* AI-Generated Summary */}
              <div className="bg-white rounded-lg border border-amber-200 p-4 md:p-6 shadow-sm mb-6 md:mb-8">
                <h3 className="text-base md:text-lg font-semibold text-gray-800 mb-4 flex items-center justify-between">
                  <span>AI Analytics Summary</span>
                  {summaryLoading && (
                    <div className="w-4 h-4 border-2 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
                  )}
                </h3>

                <div className="bg-amber-50 rounded-lg p-4 border-l-4 border-amber-400">
                  {summaryLoading ? (
                    <div className="flex items-center gap-2 text-amber-700">
                      <div
                        className="w-2 h-2 bg-amber-400 rounded-full animate-bounce"
                        style={{ animationDelay: "-0.3s" }}
                      ></div>
                      <div
                        className="w-2 h-2 bg-amber-400 rounded-full animate-bounce"
                        style={{ animationDelay: "-0.15s" }}
                      ></div>
                      <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce"></div>
                      <span className="text-sm">Generating insights...</span>
                    </div>
                  ) : aiSummary ? (
                    <p className="text-gray-700 leading-relaxed">{aiSummary}</p>
                  ) : (
                    <p className="text-gray-500 italic">
                      {data
                        ? "No summary available. Try refreshing the data."
                        : "Load analytics data to generate insights."}
                    </p>
                  )}
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                  <p className="text-red-700">{error}</p>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <footer
            className="py-6 md:py-8 text-white"
            style={{ background: "#A0874B" }}
          >
            <div className="max-w-6xl mx-auto px-4 md:px-6">
              <div className="flex flex-col lg:flex-row items-center lg:items-start justify-between gap-6 md:gap-8">
                <div className="flex-shrink-0">
                  <img
                    src="/images/uhcc-logo-2.png"
                    alt="University of Hawaii Community Colleges"
                    className="h-32 md:h-60 w-auto object-contain"
                  />
                </div>
                <div className="flex-1 lg:mx-8 text-center lg:text-left">
                  <div className="text-xs md:text-sm flex flex-wrap items-center gap-x-2 gap-y-2 justify-center lg:justify-start text-white/90">
                    {campusNames.map((campus, i) => (
                      <React.Fragment key={`campus-${i}`}>
                        <span>{campus}</span>
                        {i < campusNames.length - 1 && <span>&bull;</span>}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
                <div className="text-xs md:text-sm max-w-xs text-center lg:text-right">
                  <p>
                    The University of Hawaii is an Equal Opportunity/Affirmative
                    Action Institution. Use of this site implies consent with
                    our{" "}
                    <a href="#" className="underline hover:text-amber-200">
                      Usage Policy
                    </a>
                    .
                  </p>
                </div>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
