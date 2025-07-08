/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useRef } from "react";
import {
  PlusIcon,
  HeadphonesIcon,
  SendIcon,
  ExternalLinkIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  MessageCircleIcon,
} from "lucide-react";

type Message = {
  role: "user" | "assistant";
  content: string;
  options?: Option[];
  showInput?: boolean;
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [rateLimitInfo, setRateLimitInfo] = useState<{
    remaining?: number;
    limit?: number;
  }>({});

  // Scroll to bottom function
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [currentChat.messages, isLoading]);

  // Initial troubleshooting options for homepage
  const quickActions: QuickAction[] = [
    {
      title: "I can't log in - getting validation error",
      description: "Getting 'Invalid email address and/or password' error",
      action:
        "I'm getting a validation error when I try to log in. It says 'Invalid email address and/or password, please try again.' https://ce.uhcc.hawaii.edu/portal/logon.do?method=load",
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
    setShowChat(false); // Start back at selection screen
  };

  const handleQuickAction = (action: QuickAction) => {
    setShowChat(true);
    // Send the initial message which will get the first AI response with guided options
    setTimeout(() => handleSend(action.action), 100);
  };

  const handleOptionSelect = (option: Option) => {
    handleSend(option.action);
  };

  const handleSend = async (customMessage?: string) => {
    const messageToSend = customMessage || message;
    if (!messageToSend.trim()) return;
    setError(null);

    // Add user message to UI immediately
    const userMessage = { role: "user" as const, content: messageToSend };
    const updatedMessages = [...currentChat.messages, userMessage];

    // Generate title from first user message
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

      // Capture rate limit headers from response
      const limit = response.headers.get("X-RateLimit-Limit");
      const remaining = response.headers.get("X-RateLimit-Remaining");

      if (limit && remaining) {
        setRateLimitInfo({
          limit: parseInt(limit),
          remaining: parseInt(remaining),
        });
      }

      // Handle rate limiting
      if (response.status === 429) {
        const rateLimitData = await response.json();
        const waitTime = rateLimitData.timeRemaining || 60;

        setError(
          `Please slow down! You can send another message in ${waitTime} seconds.`
        );

        // Optional: Auto-retry after the wait time
        setTimeout(() => {
          setError(null);
        }, waitTime * 1000);

        return;
      }

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      const data = await response.json();

      // Add assistant's response with options from backend
      const assistantMessage = {
        role: "assistant" as const,
        content: data.message,
        options: data.options,
        showInput: data.showInput,
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
    } catch (error) {
      console.error("Error:", error);
      setError("Connection failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const RateLimitIndicator = ({
    remaining,
    limit,
  }: {
    remaining?: number;
    limit?: number;
  }) => {
    if (typeof remaining !== "number" || typeof limit !== "number") return null;

    const percentage = (remaining / limit) * 100;
    let status = "Good";
    let color = "bg-green-400";
    if (percentage < 20) {
      status = "Low";
      color = "bg-red-400";
    } else if (percentage < 50) {
      status = "Moderate";
      color = "bg-yellow-400";
    }

    return (
      <div className="flex items-center gap-2 text-sm text-white/90">
        <div className="flex items-center gap-1">
          <div className={`w-2 h-2 rounded-full ${color}`}></div>
          <span className="text-xs">
            {remaining} of {limit} messages left
          </span>
          <span className="text-xs ml-2">({status} - resets every minute)</span>
        </div>
      </div>
    );
  };

  const handleChatSelect = (chat: Chat) => {
    setCurrentChat(chat);
    setMessage("");
    setError(null);
    setShowChat(true);
  };

  const formatMessage = (content: string) => {
    return content.split("\n").map((line, i) => {
      // Handle headers with **Header**
      if (
        line.trim().startsWith("**") &&
        line.trim().endsWith("**") &&
        !line.includes(":")
      ) {
        const headerText = line.trim().replace(/^\*\*|\*\*$/g, "");
        return (
          <div
            key={i}
            className="text-amber-700 font-bold text-lg mb-3 mt-4 first:mt-0"
          >
            {headerText}
          </div>
        );
      }

      // Handle bullet points with •
      if (line.trim().startsWith("•")) {
        return (
          <div key={i} className="flex items-start gap-2 mb-2 ml-4">
            <span className="text-amber-600 mt-1">•</span>
            <span className="flex-1">{line.trim().substring(1).trim()}</span>
          </div>
        );
      }

      // Handle numbered steps
      const numberMatch = line.match(/^(\d+)\.\s*(.*)/);
      if (numberMatch) {
        const [, number, content] = numberMatch;
        return (
          <div key={i} className="flex items-start gap-3 mb-2 ml-4">
            <span className="bg-amber-100 text-amber-700 rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold mt-0.5">
              {number}
            </span>
            <span className="flex-1 pt-0.5">{content}</span>
          </div>
        );
      }

      // Regular text with **bold** formatting and link styling
      const formattedLine = line.replace(
        /\*\*(.*?)\*\*/g,
        "<strong>$1</strong>"
      );

      return line.trim() ? (
        <div
          key={i}
          className="mb-2 [&_a]:text-amber-700 [&_a]:hover:text-amber-800 [&_a]:underline [&_a]:cursor-pointer"
          dangerouslySetInnerHTML={{ __html: formattedLine }}
        />
      ) : (
        <div key={i} className="h-2" />
      );
    });
  };

  // Check if conversation is complete (contains contact info)
  const isConversationComplete = currentChat.messages.some(
    msg =>
      msg.role === "assistant" &&
      (msg.content.includes("📞") ||
        msg.content.includes("808-845-9129") ||
        msg.content.includes("SUCCESS!"))
  );

  return (
    <div className="flex h-screen bg-gradient-to-br from-amber-50 to-orange-50">
      {/* Sidebar - only show if chat is active */}
      {showChat && (
        <div className="w-80 bg-white border-r border-amber-200 flex flex-col shadow-lg">
          <div className="p-4 border-b border-amber-200">
            <div className="flex items-center gap-3 mb-4">
              <img
                src="/images/uhcc-logo-3.png"
                alt="UHCC Logo"
                width={40}
                className="object-contain"
              />
              <div>
                <h1 className="font-bold text-gray-800">UHCC Portal Help</h1>
                <p className="text-sm text-gray-600">Guided Support</p>
              </div>
            </div>

            <button
              onClick={handleNewChat}
              className="w-full flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 transition-colors"
            >
              <PlusIcon size={16} />
              New Help Session
            </button>
          </div>

          {/* Contact Info - only show if conversation is complete */}
          {isConversationComplete && (
            <div className="p-4 bg-amber-50 border-b border-amber-200">
              <h3 className="font-semibold text-gray-800 mb-2">
                Need More Help?
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <span>📞</span>
                  <span>808-845-9129</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <span>📧</span>
                  <span>help@hawaii.edu</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <span>🕒</span>
                  <span>Mon-Fri 8AM-4:30PM</span>
                </div>
              </div>
            </div>
          )}

          {/* Chat History */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-2">
              <h3 className="text-sm font-semibold text-gray-600 mb-2 px-2">
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
                  <h4 className="text-sm font-medium text-gray-800 truncate">
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
      <div className="flex-1 flex flex-col">
        {!showChat ? (
          /* Initial Issue Selection Screen with scrollable header and footer */
          <div className="flex-1 overflow-y-auto bg-gradient-to-br from-amber-50 to-orange-50">
            {/* Header with orange background matching UHCC */}
            <header
              className="p-4 shadow-lg text-white border-b border-black relative"
              style={{
                background: "#CA5C13",
                backgroundImage: "url('/images/UHCC-Hawaiian-logo.png')",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "10px center", // shifted right by 30px
                backgroundSize: "auto 70%",
              }}
            >
              <div className="flex items-center justify-between">
                {/* Hide the img, since it's now a background */}
                <div className="flex-1" />
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  Help Available
                </div>
              </div>
            </header>

            {/* Content */}
            <div className="p-6 bg-gradient-to-b from-amber-50/50 to-white">
              <div className="max-w-4xl mx-auto">
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-bold text-gray-800 mb-4">
                    Can&apos;t log into your UHCC account?
                  </h2>
                  <p className="text-gray-600 text-lg">
                    Choose what&apos;s happening and I&apos;ll guide you through
                    fixing it step by step.
                  </p>
                </div>

                {/* Quick Actions Grid */}
                <div className="grid md:grid-cols-2 gap-4 mb-8">
                  {quickActions.map((action, index) => (
                    <button
                      key={index}
                      onClick={() => handleQuickAction(action)}
                      className={`${action.color} border-2 rounded-lg p-6 text-left hover:shadow-lg transition-all duration-200 group bg-white`}
                    >
                      <div className="flex items-start gap-4">
                        <div className="text-gray-600 group-hover:text-amber-600 transition-colors flex-shrink-0 mt-1">
                          {action.icon}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-800 group-hover:text-amber-600 transition-colors mb-2">
                            {action.title}
                          </h4>
                          <p className="text-gray-600 text-sm">
                            {action.description}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {/* How It Works */}
                <div className="bg-white rounded-lg border border-amber-200 p-6 mb-8 shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">
                    How the UHCC Portal Reset Process Works:
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <span className="bg-amber-100 text-amber-700 rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold mt-0.5">
                        1
                      </span>
                      <div>
                        <div className="font-medium text-gray-800">
                          Email Validation
                        </div>
                        <div className="text-sm text-gray-600">
                          Use &quot;I am a new user&quot; section to check if
                          your email is in the system
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="bg-amber-100 text-amber-700 rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold mt-0.5">
                        2
                      </span>
                      <div>
                        <div className="font-medium text-gray-800">
                          Request Username
                        </div>
                        <div className="text-sm text-gray-600">
                          Use &quot;Forgot Username&quot; page to get your
                          username sent to email
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="bg-amber-100 text-amber-700 rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold mt-0.5">
                        3
                      </span>
                      <div>
                        <div className="font-medium text-gray-800">
                          Get Your Username
                        </div>
                        <div className="text-sm text-gray-600">
                          Check your email and spam folder for username from
                          UHCC
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="bg-amber-100 text-amber-700 rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold mt-0.5">
                        4
                      </span>
                      <div>
                        <div className="font-medium text-gray-800">
                          Request Password Reset
                        </div>
                        <div className="text-sm text-gray-600">
                          Use &quot;Forgot Password&quot; page with your
                          username to get reset link
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="bg-amber-100 text-amber-700 rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold mt-0.5">
                        5
                      </span>
                      <div>
                        <div className="font-medium text-gray-800">
                          Set New Password
                        </div>
                        <div className="text-sm text-gray-600">
                          Follow the reset link in your email to create a new
                          password
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="bg-green-100 text-green-700 rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold mt-0.5">
                        ✓
                      </span>
                      <div>
                        <div className="font-medium text-gray-800">
                          Login Successfully
                        </div>
                        <div className="text-sm text-gray-600">
                          Use &quot;I am an existing user&quot; section with
                          your username and new password
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 p-4 bg-amber-50 rounded-lg border border-amber-200">
                    <div className="text-sm text-amber-800">
                      <strong>💡 How I help:</strong> I&apos;ll guide you
                      through each step and give you specific options based on
                      what you might see on your screen. Just select what
                      matches your situation to get the next step!
                    </div>
                  </div>
                </div>

                {/* Portal Access */}
                <div className="bg-white rounded-lg border border-amber-200 p-6 shadow-sm mb-8">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">
                    Need to access the portal directly?
                  </h3>
                  <a
                    href="https://ce.uhcc.hawaii.edu/portal/logon.do?method=load"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 transition-colors w-fit"
                  >
                    <ExternalLinkIcon size={16} />
                    Open Portal Login
                  </a>
                </div>
              </div>
            </div>

            {/* Footer */}
            <footer
              className="py-8 text-white"
              style={{ background: "#A0874B" }}
            >
              <div className="max-w-6xl mx-auto px-6">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
                  {/* Logo Section */}
                  <div className="flex-shrink-0">
                    <img
                      src="/images/uhcc-logo-2.png"
                      alt="University of Hawaii Community Colleges"
                      className="h-60 w-auto object-contain"
                    />
                  </div>

                  {/* Campus Links */}
                  <div className="flex-1 lg:mx-8">
                    <div className="text-sm flex flex-wrap items-center gap-x-2 gap-y-2 justify-center lg:justify-start text-white/90">
                      <span>Hawaii CC</span>
                      <span>&bull;</span>
                      <span>Honolulu CC</span>
                      <span>&bull;</span>
                      <span>Kapiolani CC</span>
                      <span>&bull;</span>
                      <span>Kauai CC</span>
                      <span>&bull;</span>
                      <span>Leeward CC</span>
                      <span>&bull;</span>
                      <span>Maui College</span>
                      <span>&bull;</span>
                      <span>Windward CC</span>
                      <span>&bull;</span>
                      <span>PCATT</span>
                    </div>
                  </div>

                  {/* Equal Opportunity Statement */}
                  <div className="text-sm max-w-xs text-right">
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
          /* Guided Chat Interface */
          <>
            {/* Header with orange background matching UHCC */}
            <header
              className="p-4 shadow-lg text-white border-b border-black relative"
              style={{
                background: "#CA5C13",
                backgroundImage: "url('/images/UHCC-Hawaiian-logo.png')",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "10px center", // shifted right by 30px
                backgroundSize: "auto 70%",
              }}
            >
              <div className="flex items-center justify-between">
                {/* Hide the img, since it's now a background */}
                <div className="flex-1" />
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  Help Available
                </div>
              </div>
            </header>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-amber-50/30 to-white">
              {currentChat.messages.map((msg, index) => (
                <div key={index}>
                  <div
                    className={`flex gap-3 ${msg.role === "assistant" ? "justify-start" : "justify-end"}`}
                  >
                    {msg.role === "assistant" && (
                      <div className="w-8 h-8 bg-amber-600 rounded-full flex items-center justify-center flex-shrink-0">
                        <HeadphonesIcon className="w-4 h-4 text-white" />
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] p-4 rounded-lg ${
                        msg.role === "assistant"
                          ? "bg-white border border-amber-200 shadow-sm"
                          : "bg-amber-600 text-white"
                      }`}
                    >
                      {msg.role === "assistant" ? (
                        <div className="prose prose-sm max-w-none">
                          {formatMessage(msg.content)}
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                      )}
                    </div>
                  </div>

                  {/* Backend-Generated Options */}
                  {msg.role === "assistant" && msg.options && (
                    <div className="ml-11 mt-4 space-y-2">
                      <p className="text-sm text-gray-600 mb-3">
                        Choose what applies to you:
                      </p>
                      {msg.options.map(option => (
                        <button
                          key={option.id}
                          onClick={() => handleOptionSelect(option)}
                          className={`w-full text-left p-3 rounded-lg border ${option.color || "bg-gray-50 border-gray-200 hover:border-gray-400"} transition-all duration-200 hover:shadow-md`}
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
                          }
                        }}
                        className="w-full text-left p-3 rounded-lg border border-gray-300 bg-gray-50 hover:border-gray-400 transition-all duration-200 text-gray-600 flex items-center gap-2"
                      >
                        <MessageCircleIcon size={16} />
                        None of these match - let me type my own response
                      </button>
                    </div>
                  )}

                  {/* Free Input */}
                  {msg.role === "assistant" && msg.showInput && (
                    <div className="ml-11 mt-4">
                      <div className="flex gap-3 items-end">
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
                            className="w-full rounded-lg border border-amber-300 p-3 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
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
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 bg-amber-600 rounded-full flex items-center justify-center">
                    <HeadphonesIcon className="w-4 h-4 text-white" />
                  </div>
                  <div className="bg-white border border-amber-200 shadow-sm p-4 rounded-lg">
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
                      <span className="text-sm text-gray-600 ml-2">
                        Analyzing and helping you...
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="flex justify-center">
                  <div
                    className={`${
                      error.includes("slow down")
                        ? "bg-yellow-50 border-yellow-200 text-yellow-700"
                        : "bg-red-50 border-red-200 text-red-700"
                    } border px-4 py-3 rounded-lg max-w-md`}
                  >
                    {
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-4 h-4 rounded-full flex-shrink-0 ${
                            error.includes("slow down")
                              ? "bg-yellow-500"
                              : "bg-red-500"
                          }`}
                        ></div>
                        {error}
                      </div>
                    }
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
