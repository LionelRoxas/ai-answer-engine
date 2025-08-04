/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, FormEvent } from "react";
import { StarIcon, XIcon, CheckCircleIcon } from "lucide-react";

interface ApiResponse {
  success: boolean;
  data?: any;
  error?: string;
}

interface SidebarRatingProps {
  show?: boolean;
}

export default function SidebarRating({ show = true }: SidebarRatingProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [rating, setRating] = useState<number>(0);
  const [feedback, setFeedback] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hoverRating, setHoverRating] = useState<number>(0);

  // Don't render if show is false or already submitted
  if (!show || submitted) return null;

  const handleStarClick = (selectedRating: number) => {
    setRating(selectedRating);
    setIsModalOpen(true);
    setError(null);
  };

  const handleModalStarClick = (selectedRating: number) => {
    setRating(selectedRating);
    setError(null);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (rating === 0) {
      setError("Please select a rating");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/surveys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ rating, feedback }),
      });

      const result: ApiResponse = await response.json();

      if (response.ok) {
        setSubmitted(true);
        setIsModalOpen(false);
        setRating(0);
        setFeedback("");
      } else {
        setError(result.error || "Failed to submit survey");
      }
    } catch (error) {
      console.error("Error:", error);
      setError("Failed to submit survey. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setError(null);
  };

  return (
    <>
      {/* Sidebar Rating Widget */}
      <div className="p-4">
        <div className="bg-white rounded-2xl shadow-lg border-2 border-amber-200 p-4 transform transition-all duration-300 hover:scale-105">
          <div className="text-center mb-3">
            <p className="text-sm font-medium text-gray-700 mb-1">
              Rate your experience
            </p>
            <p className="text-xs text-gray-500">Quick feedback</p>
          </div>

          <div className="flex justify-center gap-1">
            {[1, 2, 3, 4, 5].map(star => (
              <button
                key={star}
                onClick={() => handleStarClick(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                className="transition-all duration-200 transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-amber-400 rounded"
              >
                <StarIcon
                  size={24}
                  className={`${
                    star <= (hoverRating || 0)
                      ? "text-amber-400 fill-current"
                      : "text-gray-300 hover:text-amber-300"
                  } transition-colors duration-200`}
                />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Modal Overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-6 text-center relative">
              <button
                onClick={closeModal}
                className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
              >
                <XIcon size={24} />
              </button>
              <h3 className="text-xl font-semibold text-white">
                Rate Your Experience
              </h3>
              <p className="text-amber-100 text-sm mt-1">
                Help us improve our portal support
              </p>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              {/* Star Rating in Modal */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3 text-center">
                  Overall Rating
                </label>
                <div className="flex justify-center gap-2 mb-2">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => handleModalStarClick(star)}
                      className="transition-all duration-200 transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-amber-400 rounded"
                    >
                      <StarIcon
                        size={36}
                        className={`${
                          star <= rating
                            ? "text-amber-400 fill-current"
                            : "text-gray-300 hover:text-amber-300"
                        } transition-colors duration-200`}
                      />
                    </button>
                  ))}
                </div>
                <div className="text-center">
                  {rating > 0 && (
                    <p className="text-sm text-amber-600 font-medium">
                      {rating} star{rating !== 1 ? "s" : ""} -{" "}
                      {rating === 5
                        ? "Excellent!"
                        : rating === 4
                          ? "Very Good"
                          : rating === 3
                            ? "Good"
                            : rating === 2
                              ? "Fair"
                              : "Poor"}
                    </p>
                  )}
                </div>
              </div>

              {/* Feedback */}
              <div className="mb-6">
                <label
                  htmlFor="modal-feedback"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Additional Comments{" "}
                  <span className="text-gray-400">(optional)</span>
                </label>
                <textarea
                  id="modal-feedback"
                  value={feedback}
                  onChange={e => setFeedback(e.target.value)}
                  placeholder="Tell us more about your experience with the portal support..."
                  className="w-full px-3 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors text-sm resize-none"
                  rows={4}
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-700 text-sm font-medium">{error}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-3 px-4 border-2 border-gray-200 text-gray-700 rounded-lg font-medium text-sm hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || rating === 0}
                  className={`flex-1 py-3 px-4 rounded-lg font-medium text-sm transition-all duration-200 ${
                    isSubmitting || rating === 0
                      ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                      : "bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 transform hover:scale-[1.02] shadow-md hover:shadow-lg"
                  }`}
                >
                  {isSubmitting ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                      Submitting...
                    </div>
                  ) : (
                    "Submit Feedback"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Success Toast (appears briefly after submission) */}
      {submitted && (
        <div className="fixed bottom-6 right-6 z-50 bg-green-500 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 animate-bounce">
          <CheckCircleIcon size={24} />
          <div>
            <p className="font-semibold">Thank you!</p>
            <p className="text-sm text-green-100">
              Feedback submitted successfully
            </p>
          </div>
        </div>
      )}
    </>
  );
}
