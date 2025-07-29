/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useRef } from "react";
import React from "react";
import {
  PlusIcon,
  HeadphonesIcon,
  SendIcon,
  ExternalLinkIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  MessageCircleIcon,
  MenuIcon,
  XIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react";

type MessageImage = {
  id: string;
  src: string;
  alt: string;
  caption?: string;
  width?: number;
  height?: number;
};

type Message = {
  role: "user" | "assistant";
  content: string;
  options?: Option[];
  showInput?: boolean;
  image?: MessageImage;
};

type Option = {
  id: string;
  text: string;
  action: string;
  color?: string;
};

type Chat = {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  currentStep: string;
};

type QuickAction = {
  title: string;
  description: string;
  action: string;
  icon: React.ReactNode;
  color: string;
};

export default function UHCCPortalSupport() {
  const [message, setMessage] = useState("");
  const [currentChat, setCurrentChat] = useState<Chat>({
    id: Date.now().toString(),
    title: "Portal Login Help",
    messages: [],
    createdAt: new Date(),
    currentStep: "initial",
  });
  const [chats, setChats] = useState<Chat[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [messagesSent, setMessagesSent] = useState(0);
  const [latestOptionsMessageIndex, setLatestOptionsMessageIndex] = useState<
    number | null
  >(null);

  const [rateLimitExpired, setRateLimitExpired] = useState(false);
  const [failedMessage, setFailedMessage] = useState<string>("");
  const [countdownTime, setCountdownTime] = useState<number | null>(null);
  const [totalWaitTime, setTotalWaitTime] = useState<number>(60); // Track total wait time for progress bar
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [rateLimitInfo, setRateLimitInfo] = useState<{
    remaining?: number;
    limit?: number;
    reset?: number;
  }>({});

  // Scroll to bottom function
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Create a reusable function to fetch rate limit status
  const fetchRateLimitStatus = async () => {
    try {
      const response = await fetch("/api/rate-limit-status");
      const limit = response.headers.get("X-RateLimit-Limit");
      const remaining = response.headers.get("X-RateLimit-Remaining");
      const reset = response.headers.get("X-RateLimit-Reset");

      if (limit && remaining) {
        setRateLimitInfo({
          limit: parseInt(limit),
          remaining: parseInt(remaining),
          reset: reset ? parseInt(reset) : undefined,
        });
      }
    } catch (error) {
      console.log("Could not fetch rate limit status:", error);
    }
  };

  // useEffect for initial rate limit fetch (runs once)
  useEffect(() => {
    fetchRateLimitStatus();
  }, []);

  // useEffect for periodic updates (runs every 30 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchRateLimitStatus();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [currentChat.messages, isLoading]);

  // Handle sidebar state on resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        // Desktop: sidebar can be toggled
      } else {
        // Mobile: close sidebar by default
        setSidebarOpen(false);
      }
    };

    // Set initial state
    handleResize();

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Initial troubleshooting options for homepage
  const quickActions: QuickAction[] = [
    {
      title:
        "I can't log in - I can't remember the correct username or password",
      description: "Getting 'Invalid email address and/or password' error",
      action:
        "I can't log in - I can't remember the correct username or password. It says 'Invalid email address and/or password, please try again.' https://ce.uhcc.hawaii.edu/portal/logon.do?method=load",
      icon: <AlertCircleIcon size={20} />,
      color: "bg-red-50 border-red-300 hover:border-red-500",
    },
    {
      title: "I forgot my username",
      description: "I know my email but can't remember my username",
      action:
        "I forgot my username but I have my email address. How do I reset it? https://ce.uhcc.hawaii.edu/portal/forgotUserName.do",
      icon: <ExternalLinkIcon size={20} />,
      color: "bg-blue-50 border-blue-300 hover:border-blue-500",
    },
    {
      title: "I forgot my password",
      description: "I know my username but can't remember my password",
      action:
        "I forgot my password but I know my username. How do I reset it? https://ce.uhcc.hawaii.edu/portal/studentForgotPassword.do",
      icon: <CheckCircleIcon size={20} />,
      color: "bg-green-50 border-green-300 hover:border-green-500",
    },
    {
      title: "I need to check if my email is in the system",
      description: "Not sure if I already have an account",
      action:
        "I'm not sure if my email is already in the system. How do I check? https://ce.uhcc.hawaii.edu/portal/logon.do?method=load",
      icon: <ArrowRightIcon size={20} />,
      color: "bg-amber-50 border-amber-300 hover:border-amber-500",
    },
  ];

  useEffect(() => {
    if (currentChat.messages.length === 0) {
      loadChatHistory(currentChat.id);
    }
    setChats([currentChat]);
  }, []);

  const loadChatHistory = async (chatId: string) => {
    try {
      const response = await fetch(`/api/chat?chatId=${chatId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.messages && data.messages.length > 0) {
          const existingChat = chats.find(chat => chat.id === chatId);
          if (existingChat) {
            const updatedChat = {
              ...existingChat,
              messages: data.messages,
            };
            setCurrentChat(updatedChat);
            setChats(prev =>
              prev.map(chat => (chat.id === chatId ? updatedChat : chat))
            );
          }
        }
      }
    } catch (error) {
      console.error("Error loading chat history:", error);
      setError("Failed to load chat history");
    }
  };

  const handleNewChat = () => {
    const newChat: Chat = {
      id: Date.now().toString(),
      title: "Portal Login Help",
      messages: [],
      createdAt: new Date(),
      currentStep: "initial",
    };
    setChats(prev => [newChat, ...prev]);
    setCurrentChat(newChat);
    setShowChat(false);
    setSidebarOpen(window.innerWidth >= 768); // Open on desktop, closed on mobile
    setMessagesSent(0);
    setLatestOptionsMessageIndex(null);
  };

  const handleQuickAction = (action: QuickAction) => {
    setShowChat(true);
    setSidebarOpen(window.innerWidth >= 768); // Open on desktop, closed on mobile
    setTimeout(() => handleSend(action.action), 100);
  };

  const handleOptionSelect = (option: Option) => {
    handleSend(option.action);
  };

  const handleSend = async (customMessage?: string) => {
    const messageToSend = customMessage || message;
    if (!messageToSend.trim()) return;
    setError(null);
    setRateLimitExpired(false); // Reset rate limit expired state
    setCountdownTime(null); // Reset countdown

    // Clear any existing countdown interval
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    setMessagesSent(prev => prev + 1);

    const userMessage = { role: "user" as const, content: messageToSend };
    const updatedMessages = [...currentChat.messages, userMessage];

    const title =
      currentChat.messages.length === 0
        ? messageToSend.slice(0, 30) + (messageToSend.length > 30 ? "..." : "")
        : currentChat.title;

    const updatedChat = {
      ...currentChat,
      messages: updatedMessages,
      title,
    };
    setCurrentChat(updatedChat);
    setChats(prev =>
      prev.map(chat => (chat.id === currentChat.id ? updatedChat : chat))
    );

    setMessage("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageToSend,
          messages: updatedMessages,
          chatId: currentChat.id,
        }),
      });

      if (response.status === 429) {
        const rateLimitData = await response.json();
        const waitTime = rateLimitData.timeRemaining || 60;

        // Remove the user message since it failed
        setCurrentChat(prev => ({
          ...prev,
          messages: prev.messages.slice(0, -1),
        }));
        setChats(prev =>
          prev.map(chat =>
            chat.id === currentChat.id
              ? { ...chat, messages: chat.messages.slice(0, -1) }
              : chat
          )
        );

        // Store the failed message and start countdown
        setFailedMessage(messageToSend);
        setCountdownTime(waitTime + 3);
        setTotalWaitTime(waitTime + 3); // Store total wait time for progress calculation
        setError(
          `Please slow down! You can send another message in ${waitTime} seconds.`
        );

        // Start the countdown timer
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
        }

        countdownIntervalRef.current = setInterval(() => {
          setCountdownTime(prev => {
            if (prev === null || prev <= 1) {
              if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current);
                countdownIntervalRef.current = null;
              }

              // Show "preparing to retry" message
              setError("Preparing to retry... please wait a moment.");

              // Add a small delay before allowing retry to ensure server rate limit has expired
              setTimeout(async () => {
                // Verify with server that rate limit has expired
                await fetchRateLimitStatus();
                setError(null);
                setRateLimitExpired(true);
              }, 2000); // Wait 2 extra seconds after countdown finishes

              return null;
            }
            const newTime = prev - 1;
            setError(
              `Please slow down! You can send another message in ${newTime} seconds.`
            );
            return newTime;
          });
        }, 1000);

        return;
      }

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      const data = await response.json();

      const assistantMessage = {
        role: "assistant" as const,
        content: data.message,
        options: data.options,
        showInput: data.showInput,
        image: data.image,
      };

      const finalMessages = [...updatedMessages, assistantMessage];
      const finalChat = {
        ...updatedChat,
        messages: finalMessages,
      };

      setCurrentChat(finalChat);
      setChats(prev =>
        prev.map(chat => (chat.id === currentChat.id ? finalChat : chat))
      );

      fetchRateLimitStatus();

      if (data.options && data.options.length > 0) {
        setLatestOptionsMessageIndex(finalMessages.length - 1);
      }
    } catch (error) {
      console.error("Error:", error);
      setError("Connection failed. Please try again.");
      setRateLimitExpired(true); // Also show input on connection error
    } finally {
      setIsLoading(false);
    }
  };

  // Add cleanup effect for countdown interval
  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, []);

  // Add this new component for the rate limit recovery input
  // Replace your existing RateLimitRecoveryInput component with this fixed version:

  const RateLimitRecoveryInput = () => {
    // Get the current textarea value (either from message state or failedMessage)
    const currentValue = message || failedMessage;

    const sendMessage = async () => {
      const messageToSend = currentValue.trim();
      if (messageToSend) {
        // Double-check rate limit status before sending
        await fetchRateLimitStatus();

        handleSend(messageToSend); // Pass the message explicitly
        setRateLimitExpired(false);
        setFailedMessage(""); // Clear failed message after sending
      }
    };

    return (
      <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-sm text-yellow-800 mb-3">
          {failedMessage
            ? "Ready to retry your message:"
            : "You can now send a message:"}
        </p>
        <div className="flex gap-2 md:gap-3 items-end">
          <div className="flex-1">
            <textarea
              value={currentValue}
              onChange={e => {
                const newValue = e.target.value;
                setMessage(newValue);
                if (failedMessage) setFailedMessage(""); // Clear failed message when user starts typing
              }}
              onKeyPress={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Describe exactly what you see or what's happening..."
              className="w-full rounded-lg border border-yellow-300 p-3 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent resize-none text-gray-900 text-sm md:text-base"
              rows={3}
            />
          </div>
          <button
            onClick={sendMessage}
            disabled={isLoading || !currentValue.trim()}
            className="bg-yellow-600 text-white p-3 rounded-lg hover:bg-yellow-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex-shrink-0"
          >
            <SendIcon size={16} />
          </button>
        </div>
      </div>
    );
  };

  const RateLimitIndicator = ({
    remaining,
    limit,
  }: {
    remaining?: number;
    limit?: number;
    reset?: number;
  }) => {
    if (typeof remaining !== "number" || typeof limit !== "number") {
      return (
        <div className="flex items-center gap-2 text-sm text-white/90">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-blue-400"></div>
            <span className="text-xs">{messagesSent} messages sent</span>
          </div>
        </div>
      );
    }

    const color = "bg-green-400";

    return (
      <div className="flex items-center gap-2 text-sm text-white/90">
        <div className="flex items-center gap-1">
          <div className={`w-2 h-2 rounded-full ${color}`}></div>
          <span className="text-xs">{messagesSent} messages sent</span>
        </div>
      </div>
    );
  };

  const handleChatSelect = (chat: Chat) => {
    setCurrentChat(chat);
    setMessage("");
    setError(null);
    setShowChat(true);
    setSidebarOpen(false); // Close sidebar when selecting chat on mobile
  };

  // Function to toggle sidebar and handle desktop layout
  const toggleSidebar = () => {
    if (window.innerWidth >= 768) {
      // Desktop: toggle sidebar
      setSidebarOpen(!sidebarOpen);
    } else {
      // Mobile: just toggle overlay
      setSidebarOpen(!sidebarOpen);
    }
  };

  const formatMessage = (content: string, image?: MessageImage) => {
    const messageElements = [];

    const textContent = content.split("\n").map((line, i) => {
      if (
        line.trim().startsWith("**") &&
        line.trim().endsWith("**") &&
        !line.includes(":")
      ) {
        const headerText = line.trim().replace(/^\*\*|\*\*$/g, "");
        return (
          <div
            key={`header-${i}`}
            className="text-amber-700 font-bold text-base md:text-lg mb-3 mt-4 first:mt-0"
          >
            {headerText}
          </div>
        );
      }

      if (line.trim().startsWith("•")) {
        return (
          <div key={`bullet-${i}`} className="flex items-start gap-2 mb-2 ml-4">
            <span className="text-amber-600 mt-1">•</span>
            <span className="flex-1 text-sm md:text-base">
              {line.trim().substring(1).trim()}
            </span>
          </div>
        );
      }

      const numberMatch = line.match(/^(\d+)\.\s*(.*)/);
      if (numberMatch) {
        const [, number, content] = numberMatch;
        return (
          <div key={`number-${i}`} className="flex items-start gap-3 mb-2 ml-4">
            <span className="bg-amber-100 text-amber-700 rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold mt-0.5 flex-shrink-0">
              {number}
            </span>
            <span className="flex-1 pt-0.5 text-sm md:text-base">
              {content}
            </span>
          </div>
        );
      }

      const formattedLine = line.replace(
        /\*\*(.*?)\*\*/g,
        "<strong>$1</strong>"
      );

      return line.trim() ? (
        <div
          key={`text-${i}`}
          className="mb-2 text-sm md:text-base [&_a]:text-amber-700 [&_a]:hover:text-amber-800 [&_a]:underline [&_a]:cursor-pointer"
          dangerouslySetInnerHTML={{ __html: formattedLine }}
        />
      ) : (
        <div key={`space-${i}`} className="h-2" />
      );
    });

    messageElements.push(<div key="content">{textContent}</div>);

    if (image) {
      messageElements.push(
        <div key="image" className="mt-4">
          <div className="border border-amber-200 rounded-lg overflow-hidden bg-white shadow-sm max-w-full md:max-w-md">
            <img
              src={image.src}
              alt={image.alt}
              className="w-full h-auto"
              style={{
                width: image.width || "auto",
                height: image.height || "auto",
                maxHeight: "200px",
                objectFit: "contain",
              }}
              onError={e => {
                const container = e.currentTarget.closest(".border");
                if (container) {
                  (container as HTMLElement).style.display = "none";
                }
              }}
            />
            {image.caption && (
              <div className="p-2 bg-amber-50 border-t border-amber-200">
                <p className="text-xs text-amber-800 font-medium">
                  {image.caption}
                </p>
              </div>
            )}
          </div>
        </div>
      );
    }

    return messageElements;
  };

  const isConversationComplete = currentChat.messages.some(
    msg =>
      msg.role === "assistant" &&
      (msg.content.includes("📞") ||
        msg.content.includes("808-842-2563") ||
        msg.content.includes("SUCCESS!"))
  );

  // Campus names for footer
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

  // Process steps for how it works section
  const processSteps = [
    {
      step: "1",
      title: "Email Validation",
      desc: 'Use "I am a new user" section to check if your email is in the system',
    },
    {
      step: "2",
      title: "Request Username",
      desc: 'Use "Forgot Username" page to get your username sent to email',
    },
    {
      step: "3",
      title: "Get Your Username",
      desc: "Check your email and spam folder for username from UHCC",
    },
    {
      step: "4",
      title: "Request Password Reset",
      desc: 'Use "Forgot Password" page with your username to get reset link',
    },
    {
      step: "5",
      title: "Set New Password",
      desc: "Follow the reset link in your email to create a new password",
    },
    {
      step: "✓",
      title: "Login Successfully",
      desc: 'Use "I am an existing user" section with your username and new password',
      isSuccess: true,
    },
  ];

  return (
    <div className="flex h-screen bg-gradient-to-br from-amber-50 to-orange-50 text-gray-900">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      {showChat && sidebarOpen && (
        <div
          className="
            fixed md:relative
            w-80 h-full
            bg-white border-r border-amber-200 
            flex flex-col shadow-lg
            z-50 md:z-auto
            transition-all duration-300 ease-in-out
          "
        >
          {/* Sidebar Header */}
          <div className="p-4 border-b border-amber-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <img
                  src="/images/uhcc-logo-3.png"
                  alt="UHCC Logo"
                  width={40}
                  className="object-contain"
                />
                <div>
                  <h1 className="font-bold text-gray-800 text-sm md:text-base">
                    UHCC Portal Help
                  </h1>
                  <p className="text-xs md:text-sm text-gray-600">
                    Guided Support
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="md:hidden p-2 hover:bg-gray-100 rounded-lg"
              >
                <XIcon size={20} />
              </button>
            </div>

            <button
              onClick={handleNewChat}
              className="w-full flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 transition-colors text-sm md:text-base"
            >
              <PlusIcon size={16} />
              New Help Session
            </button>
          </div>

          {/* Contact Info */}
          {isConversationComplete && (
            <div className="p-4 bg-amber-50 border-b border-amber-200">
              <h3 className="font-semibold text-gray-800 mb-2 text-sm md:text-base">
                Need More Help?
              </h3>
              <div className="space-y-2 text-xs md:text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <span>📞</span>
                  <span>808-842-2563</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <span>📧</span>
                  <span className="break-all">uhcccewd@hawaii.edu</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <span>🕒</span>
                  <span>Mon-Fri 8AM-3PM</span>
                </div>
              </div>
            </div>
          )}

          {/* Chat History */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-2">
              <h3 className="text-xs md:text-sm font-semibold text-gray-600 mb-2 px-2">
                Recent Sessions
              </h3>
              {chats.map(chat => (
                <button
                  key={chat.id}
                  onClick={() => handleChatSelect(chat)}
                  className={`w-full text-left p-3 rounded-lg mb-2 transition-colors ${
                    currentChat.id === chat.id
                      ? "bg-amber-100 border border-amber-300"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <h4 className="text-xs md:text-sm font-medium text-gray-800 truncate">
                    {chat.title}
                  </h4>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(chat.createdAt).toLocaleDateString()}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out ${
          showChat && sidebarOpen && window.innerWidth >= 768 ? "ml-0" : ""
        }`}
      >
        {!showChat ? (
          /* Initial Issue Selection Screen */
          <div className="flex-1 overflow-y-auto bg-gradient-to-br from-amber-50 to-orange-50">
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
                <div className="flex-1" />
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span className="hidden sm:inline">Online</span>
                  <span className="sm:hidden">Online</span>
                </div>
              </div>
            </header>

            {/* Content */}
            <div className="p-4 md:p-6 bg-gradient-to-b from-amber-50/50 to-white">
              <div className="max-w-4xl mx-auto">
                <div className="text-center mb-6 md:mb-8">
                  <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-3 md:mb-4">
                    Can&apos;t log into your UHCC account?
                  </h2>
                  <p className="text-gray-600 text-base md:text-lg px-2">
                    Choose what&apos;s happening and I&apos;ll guide you through
                    fixing it step by step.
                  </p>
                </div>

                {/* Quick Actions Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mb-6 md:mb-8">
                  {quickActions.map((action, index) => (
                    <button
                      key={`action-${index}`}
                      onClick={() => handleQuickAction(action)}
                      className={`relative group border-2 rounded-xl p-4 md:p-6 text-left transition-all duration-200 bg-white hover:shadow-xl focus:ring-2 focus:ring-amber-400 ${action.color}`}
                      style={{
                        boxShadow:
                          index === 0
                            ? "0 0 0 2px #fbbf24, 0 4px 24px 0 rgba(202,92,19,0.08)"
                            : undefined,
                        zIndex: index === 0 ? 1 : undefined,
                      }}
                    >
                      {index === 0 && (
                        <span className="absolute -top-2 md:-top-3 right-2 md:right-4 px-2 py-0.5 rounded-full bg-amber-600 text-white text-xs font-semibold shadow border border-amber-700 animate-pulse">
                          Recommended
                        </span>
                      )}
                      <div className="flex items-start gap-3 md:gap-4">
                        <div className="text-gray-600 group-hover:text-amber-600 transition-colors flex-shrink-0 mt-1">
                          {action.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-gray-800 group-hover:text-amber-600 transition-colors text-base md:text-lg mb-1">
                            {action.title}
                          </h4>
                          <p className="text-gray-600 text-sm">
                            {action.description}
                          </p>
                        </div>
                      </div>
                      <div className="absolute bottom-3 md:bottom-4 right-3 md:right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <ArrowRightIcon size={20} className="text-amber-600" />
                      </div>
                    </button>
                  ))}
                </div>

                {/* How It Works - Collapsed on mobile by default */}
                <details className="bg-white rounded-lg border border-amber-200 p-4 md:p-6 mb-6 md:mb-8 shadow-sm">
                  <summary className="cursor-pointer font-semibold text-gray-800 text-base md:text-lg mb-2 md:mb-4">
                    How the UHCC Portal Reset Process Works
                  </summary>
                  <div className="space-y-3 mt-4">
                    {processSteps.map((item, i) => (
                      <div key={`step-${i}`} className="flex items-start gap-3">
                        <span
                          className={`${item.isSuccess ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"} rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold mt-0.5 flex-shrink-0`}
                        >
                          {item.step}
                        </span>
                        <div className="min-w-0">
                          <div className="font-medium text-gray-800 text-sm md:text-base">
                            {item.title}
                          </div>
                          <div className="text-xs md:text-sm text-gray-600">
                            {item.desc}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 p-3 md:p-4 bg-amber-50 rounded-lg border border-amber-200">
                    <div className="text-xs md:text-sm text-amber-800">
                      <strong>💡 How I help:</strong> I&apos;ll guide you
                      through each step and give you specific options based on
                      what you might see on your screen. Just select what
                      matches your situation to get the next step!
                    </div>
                  </div>
                </details>

                {/* Portal Access */}
                <div className="bg-white rounded-lg border border-amber-200 p-4 md:p-6 shadow-sm mb-6 md:mb-8">
                  <h3 className="text-base md:text-lg font-semibold text-gray-800 mb-3 md:mb-4">
                    Need to access the portal directly?
                  </h3>
                  <a
                    href="https://ce.uhcc.hawaii.edu/portal/logon.do?method=load"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 transition-colors w-fit text-sm md:text-base"
                  >
                    <ExternalLinkIcon size={16} />
                    Open Portal Login
                  </a>
                </div>
              </div>
            </div>

            {/* Footer - Simplified on mobile */}
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
                      The University of Hawaii is an Equal
                      Opportunity/Affirmative Action Institution. Use of this
                      site implies consent with our{" "}
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
        ) : (
          /* Chat Interface */
          <>
            {/* Chat Header */}
            <header
              className="p-3 md:p-4 shadow-lg text-white border-b border-black relative"
              style={{
                background: "#CA5C13",
                backgroundImage: "url('/images/UHCC-Hawaiian-logo.png')",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "55px center",
                backgroundSize: "auto 50%",
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 md:gap-4">
                  {/* Mobile menu button / Desktop sidebar toggle */}
                  <button
                    onClick={toggleSidebar}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <MenuIcon size={20} className="md:hidden" />
                    {sidebarOpen ? (
                      <ChevronLeftIcon size={20} className="hidden md:block" />
                    ) : (
                      <ChevronRightIcon size={20} className="hidden md:block" />
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-4">
                  <RateLimitIndicator
                    remaining={rateLimitInfo.remaining}
                    limit={rateLimitInfo.limit}
                    reset={rateLimitInfo.reset}
                  />
                </div>
              </div>
            </header>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3 md:space-y-4 bg-gradient-to-b from-amber-50/30 to-white">
              {currentChat.messages.map((msg, index) => (
                <div key={`message-${index}`}>
                  <div
                    className={`flex gap-2 md:gap-3 ${msg.role === "assistant" ? "justify-start" : "justify-end"}`}
                  >
                    {msg.role === "assistant" && (
                      <div className="w-7 h-7 md:w-8 md:h-8 bg-amber-600 rounded-full flex items-center justify-center flex-shrink-0">
                        <HeadphonesIcon className="w-3 h-3 md:w-4 md:h-4 text-white" />
                      </div>
                    )}
                    <div
                      className={`max-w-[85%] md:max-w-[80%] p-3 md:p-4 rounded-lg ${
                        msg.role === "assistant"
                          ? "bg-white border border-amber-200 shadow-sm text-gray-900"
                          : "bg-amber-600 text-white"
                      }`}
                    >
                      {msg.role === "assistant" ? (
                        <div className="prose prose-sm max-w-none">
                          {formatMessage(msg.content, msg.image)}
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap text-sm md:text-base">
                          {msg.content}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Backend-Generated Options */}
                  {msg.role === "assistant" &&
                    msg.options &&
                    index === latestOptionsMessageIndex && (
                      <div className="ml-8 md:ml-11 mt-3 md:mt-4 space-y-2">
                        <p className="text-xs md:text-sm text-gray-600 mb-3">
                          Choose what applies to you:
                        </p>
                        {msg.options.map(option => (
                          <button
                            key={option.id}
                            onClick={() => handleOptionSelect(option)}
                            className={`w-full text-left p-3 rounded-lg border ${option.color || "bg-gray-50 border-gray-200 hover:border-gray-400"} transition-all duration-200 hover:shadow-md text-gray-900 text-sm md:text-base`}
                          >
                            {option.text}
                          </button>
                        ))}
                        <button
                          onClick={() => {
                            const lastMessage =
                              currentChat.messages[
                                currentChat.messages.length - 1
                              ];
                            if (lastMessage.role === "assistant") {
                              lastMessage.showInput = true;
                              lastMessage.options = undefined;
                              setCurrentChat({ ...currentChat });
                              setLatestOptionsMessageIndex(null);
                            }
                          }}
                          className="w-full text-left p-3 rounded-lg border border-gray-300 bg-gray-50 hover:border-gray-400 transition-all duration-200 text-gray-600 flex items-center gap-2 text-sm md:text-base"
                        >
                          <MessageCircleIcon size={16} />
                          <span className="hidden sm:inline">
                            None of these match - let me type my own response
                          </span>
                          <span className="sm:hidden">
                            Type my own response
                          </span>
                        </button>
                      </div>
                    )}

                  {/* Free Input */}
                  {msg.role === "assistant" &&
                    msg.showInput &&
                    index === currentChat.messages.length - 1 && (
                      <div className="ml-8 md:ml-11 mt-3 md:mt-4">
                        <div className="flex gap-2 md:gap-3 items-end">
                          <div className="flex-1">
                            <textarea
                              value={message}
                              onChange={e => setMessage(e.target.value)}
                              onKeyPress={e => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                  e.preventDefault();
                                  handleSend();
                                }
                              }}
                              placeholder="Describe exactly what you see or what's happening..."
                              className="w-full rounded-lg border border-amber-300 p-3 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none text-gray-900 text-sm md:text-base"
                              rows={3}
                            />
                          </div>
                          <button
                            onClick={() => handleSend()}
                            disabled={isLoading || !message.trim()}
                            className="bg-amber-600 text-white p-3 rounded-lg hover:bg-amber-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex-shrink-0"
                          >
                            <SendIcon size={16} />
                          </button>
                        </div>
                      </div>
                    )}
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-2 md:gap-3 justify-start">
                  <div className="w-7 h-7 md:w-8 md:h-8 bg-amber-600 rounded-full flex items-center justify-center">
                    <HeadphonesIcon className="w-3 h-3 md:w-4 md:h-4 text-white" />
                  </div>
                  <div className="bg-white border border-amber-200 shadow-sm p-3 md:p-4 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 bg-amber-400 rounded-full animate-bounce"
                        style={{ animationDelay: "-0.3s" }}
                      ></div>
                      <div
                        className="w-2 h-2 bg-amber-400 rounded-full animate-bounce"
                        style={{ animationDelay: "-0.15s" }}
                      ></div>
                      <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce"></div>
                    </div>
                  </div>
                </div>
              )}

              {/* Rate Limit Recovery Input */}
              {rateLimitExpired &&
                !isLoading &&
                currentChat.messages.length > 0 && <RateLimitRecoveryInput />}

              {error && (
                <div className="flex justify-center px-2">
                  <div
                    className={`${
                      error.includes("slow down")
                        ? "bg-yellow-50 border-yellow-200 text-yellow-700"
                        : "bg-red-50 border-red-200 text-red-700"
                    } border px-3 md:px-4 py-3 rounded-lg max-w-md text-sm md:text-base`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-4 h-4 rounded-full flex-shrink-0 ${
                          error.includes("slow down")
                            ? "bg-yellow-500"
                            : "bg-red-500"
                        }`}
                      ></div>
                      <div className="flex-1">
                        {error}
                        {/* Live countdown progress bar */}
                        {countdownTime !== null &&
                          error.includes("slow down") && (
                            <div className="mt-2">
                              <div className="w-full bg-yellow-200 rounded-full h-2">
                                <div
                                  className="bg-yellow-500 h-2 rounded-full transition-all duration-1000 ease-linear"
                                  style={{
                                    width: `${((totalWaitTime - countdownTime) / totalWaitTime) * 100}%`,
                                  }}
                                ></div>
                              </div>
                              <div className="flex justify-between items-center mt-1 text-xs">
                                <span className="animate-pulse">
                                  ⏱️ {countdownTime}s remaining
                                </span>
                                <span className="font-mono">
                                  {Math.round(
                                    ((totalWaitTime - countdownTime) /
                                      totalWaitTime) *
                                      100
                                  )}
                                  %
                                </span>
                              </div>
                            </div>
                          )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Scroll anchor */}
              <div ref={messagesEndRef} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
