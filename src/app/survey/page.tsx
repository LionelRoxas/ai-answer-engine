/* eslint-disable @next/next/no-img-element */
/* eslint-disable @next/next/no-html-link-for-pages */
"use client";

import { useState, useEffect } from "react";
import React from "react";
import { RefreshCwIcon, StarIcon } from "lucide-react";

interface Survey {
  id: string;
  rating: number;
  feedback: string | null;
  createdAt: string;
}

interface SurveyData {
  surveys: Survey[];
  average: number;
  total: number;
}

interface RatingCounts {
  [key: number]: number;
}

export default function SurveyResults() {
  const [data, setData] = useState<SurveyData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSurveys();
  }, []);

  const fetchSurveys = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/surveys");
      if (response.ok) {
        const result: SurveyData = await response.json();
        setData(result);
      } else {
        setError("Failed to fetch survey data");
      }
    } catch (error) {
      setError("Error loading survey data");
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <StarIcon
        key={i}
        size={16}
        className={i < rating ? "text-amber-400 fill-current" : "text-gray-300"}
      />
    ));
  };

  const getRatingCounts = (): RatingCounts => {
    if (!data?.surveys) return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    const counts: RatingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    data.surveys.forEach((survey: Survey) => {
      counts[survey.rating]++;
    });
    return counts;
  };

  const getPercentage = (count: number, total: number): number => {
    return total > 0 ? (count / total) * 100 : 0;
  };

  const getRatingLabel = (rating: number): string => {
    const labels = {
      5: "Excellent",
      4: "Very Good",
      3: "Good",
      2: "Fair",
      1: "Poor",
    };
    return labels[rating as keyof typeof labels] || "";
  };

  // Campus names for footer (same as original)
  const campusNames = [
    "Hawaii CC",
    "Honolulu CC",
    "Kapiolani CC",
    "Kauai CC",
    "Leeward CC",
    "Maui College",
    "Windward CC",
    "PCATT",
  ];

  if (loading) {
    return (
      <div className="flex h-screen bg-gradient-to-br from-amber-50 to-orange-50 text-gray-900">
        <div className="flex-1 flex flex-col">
          {/* Header matching original */}
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
              <div className="flex items-center gap-2 text-sm">
              </div>
            </div>
          </header>

          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="inline-flex items-center gap-2 text-amber-600 mb-4">
                <div className="w-6 h-6 border-2 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-lg font-medium">
                  Loading survey results...
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen bg-gradient-to-br from-amber-50 to-orange-50 text-gray-900">
        <div className="flex-1 flex flex-col">
          {/* Header matching original */}
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
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                <span className="hidden sm:inline">Error Loading</span>
                <span className="sm:hidden">Error</span>
              </div>
            </div>
          </header>

          <div className="flex-1 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg border border-amber-200 p-6 shadow-sm max-w-md w-full text-center">
              <div className="text-red-600 text-lg font-semibold mb-4">
                {error}
              </div>
              <button
                onClick={fetchSurveys}
                className="bg-amber-600 text-white px-6 py-3 rounded-lg hover:bg-amber-700 transition-colors font-medium"
                type="button"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const ratingCounts = getRatingCounts();

  return (
    <div className="flex h-screen bg-gradient-to-br from-amber-50 to-orange-50 text-gray-900">
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header matching original exactly */}
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
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span className="hidden sm:inline">Active</span>
                <span className="sm:hidden">Active</span>
              </div>
            </div>
          </div>
        </header>

        {/* Content with original page styling - now includes footer in scroll */}
        <div className="flex-1 overflow-y-auto bg-gradient-to-b from-amber-50/50 to-white">
          <div className="p-4 md:p-6 bg-gradient-to-b from-amber-50/50 to-white">
            <div className="max-w-4xl mx-auto">
              {/* Title matching original style */}
              <div className="text-center mb-6 md:mb-8">
                <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-3 md:mb-4">
                  Portal Support Feedback Results
                </h2>
                <p className="text-gray-600 text-base md:text-lg px-2">
                  See how we&apos;re doing with helping students access the UHCC
                  portal.
                </p>
              </div>

              {/* Summary Stats Grid - matching original quick actions style */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-6 md:mb-8">
                <div className="bg-white border-2 rounded-xl p-4 md:p-6 transition-all duration-200 bg-blue-50 border-blue-300 hover:border-blue-500 shadow-sm hover:shadow-xl">
                  <div className="flex items-start gap-3 md:gap-4">
                    <div className="text-blue-600 flex-shrink-0 mt-1">
                      <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                        #
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-blue-600 text-base md:text-lg mb-1">
                        Total Responses
                      </h4>
                      <p className="text-3xl font-bold text-blue-600 mb-1">
                        {data?.total || 0}
                      </p>
                      <p className="text-blue-600/80 text-sm">
                        feedback submissions
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white border-2 rounded-xl p-4 md:p-6 transition-all duration-200 bg-green-50 border-green-300 hover:border-green-500 shadow-sm hover:shadow-xl">
                  <div className="flex items-start gap-3 md:gap-4">
                    <div className="text-green-600 flex-shrink-0 mt-1">
                      <StarIcon size={20} className="fill-current" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-green-600 text-base md:text-lg mb-1">
                        Average Rating
                      </h4>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-3xl font-bold text-green-600">
                          {data?.average ? data.average.toFixed(1) : "0.0"}
                        </p>
                        <div className="flex">
                          {renderStars(Math.round(data?.average || 0))}
                        </div>
                      </div>
                      <p className="text-green-600/80 text-sm">
                        out of 5 stars
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white border-2 rounded-xl p-4 md:p-6 transition-all duration-200 bg-amber-50 border-amber-300 hover:border-amber-500 shadow-sm hover:shadow-xl">
                  <div className="flex items-start gap-3 md:gap-4">
                    <div className="text-amber-600 flex-shrink-0 mt-1">
                      <div className="w-5 h-5 bg-amber-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                        💬
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-amber-600 text-base md:text-lg mb-1">
                        With Comments
                      </h4>
                      <p className="text-3xl font-bold text-amber-600 mb-1">
                        {data?.surveys?.filter(
                          s => s.feedback && s.feedback.trim()
                        ).length || 0}
                      </p>
                      <p className="text-amber-600/80 text-sm">
                        detailed feedback
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Rating Distribution - matching original style */}
              <div className="bg-white rounded-lg border border-amber-200 p-4 md:p-6 shadow-sm mb-6 md:mb-8">
                <h3 className="text-base md:text-lg font-semibold text-gray-800 mb-4">
                  Rating Distribution
                </h3>
                <div className="space-y-3">
                  {[5, 4, 3, 2, 1].map((rating: number) => (
                    <div key={rating} className="flex items-center gap-4">
                      <div className="flex items-center gap-2 w-20">
                        <span className="text-sm font-medium">{rating}</span>
                        <StarIcon
                          size={16}
                          className="text-amber-400 fill-current"
                        />
                      </div>

                      <div className="flex-1 bg-gray-200 rounded-full h-3 relative overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-amber-400 to-orange-400 h-3 rounded-full transition-all duration-1000 ease-out"
                          style={{
                            width: `${getPercentage(ratingCounts[rating], data?.total || 0)}%`,
                          }}
                        ></div>
                      </div>

                      <div className="w-16 text-right">
                        <span className="text-sm font-medium">
                          {ratingCounts[rating]}
                        </span>
                        <span className="text-xs text-gray-500 block">
                          (
                          {getPercentage(
                            ratingCounts[rating],
                            data?.total || 0
                          ).toFixed(1)}
                          %)
                        </span>
                      </div>

                      <div className="w-20 text-right">
                        <span className="text-xs text-gray-600">
                          {getRatingLabel(rating)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Feedback - matching original style */}
              <div className="bg-white rounded-lg border border-amber-200 p-4 md:p-6 shadow-sm mb-6 md:mb-8">
                <h3 className="text-base md:text-lg font-semibold text-gray-800 flex items-center justify-between mb-4">
                  <span>Recent Feedback</span>
                  <button
                    onClick={fetchSurveys}
                    className="flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors text-sm"
                    type="button"
                  >
                    <RefreshCwIcon size={14} />
                    Refresh
                  </button>
                </h3>

                <div className="space-y-4">
                  {data?.surveys && data.surveys.length > 0 ? (
                    data.surveys.map((survey: Survey) => (
                      <div
                        key={survey.id}
                        className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="flex">
                              {renderStars(survey.rating)}
                            </div>
                            <span className="text-sm font-medium text-gray-600">
                              ({survey.rating} star
                              {survey.rating !== 1 ? "s" : ""})
                            </span>
                          </div>
                          <div className="text-sm text-gray-500">
                            {formatDate(survey.createdAt)}
                          </div>
                        </div>
                        {survey.feedback && survey.feedback.trim() && (
                          <div className="bg-amber-50 rounded-lg p-3 border-l-4 border-amber-400">
                            <p className="text-gray-700 text-sm">
                              &ldquo;{survey.feedback}&rdquo;
                            </p>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <p className="text-lg font-medium">
                        No survey responses yet
                      </p>
                      <p className="text-sm">
                        Responses will appear here once users submit feedback
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Footer - now part of scroll content */}
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
