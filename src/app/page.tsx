/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect } from "react";
import { PlusIcon, BrainIcon, SendIcon } from "lucide-react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type Chat = {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  suggestedQueries?: string[];
};

function calculateSmartQuestionScore(question: string): number {
  if (!question.trim()) return 0;

  let score = 0;
  const urlPattern =
    /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;

  // Base points for attempting a question
  score += 10;

  // URL presence and validity (40 points)
  if (urlPattern.test(question)) {
    score += 50;
    // Bonus for valid domain extensions
    if (/\.(com|org|edu|gov|net)/.test(question)) score += 5;
  }

  // Question specificity (25 points)
  const specificityMarkers = [
    "what",
    "why",
    "how",
    "analyze",
    "explain",
    "compare",
    "critique",
    "evaluate",
    "assess",
    "examine",
  ];
  if (
    specificityMarkers.some(marker => question.toLowerCase().includes(marker))
  ) {
    score += 20;
  }

  // Question length and detail (20 points)
  const words = question.trim().split(/\s+/).length;
  score += Math.min(20, Math.floor(words / 5) * 5);

  return Math.min(100, score);
}

function getMeterDescription(score: number): { text: string; color: string } {
  if (!score)
    return {
      text: "Waiting for your question...",
      color: "text-blue-400/60",
    };
  if (score < 30)
    return {
      text: "Add a URL and be more specific",
      color: "text-red-400",
    };
  if (score < 50)
    return {
      text: "Getting there. What exactly do you want to know?",
      color: "text-yellow-400",
    };
  if (score < 70)
    return {
      text: "Better. Add more context?",
      color: "text-blue-400",
    };
  return {
    text: "Strong question!",
    color: "text-green-400",
  };
}

export default function Home() {
  const [message, setMessage] = useState("");
  const [currentChat, setCurrentChat] = useState<Chat>({
    id: Date.now().toString(),
    title: "New Chat",
    messages: [
      {
        role: "assistant",
        content: `
    **Listen up — this is your tool to practice asking smart questions.**
    
    1. **Stop Being Vague** — Give me specifics or a valid URL. No more generic nonsense.
    2. **Provide Context** — Paste the content or link you're asking about. Don’t make me guess.
    3. **Challenge Me Right** — Ask specific, clear questions if you want answers. Don't waste my time with broad crap.
    
    **This is a tool for you to get better at thinking critically. Bring your best or don’t bother.**
    `,
      },
    ],
    createdAt: new Date(),
    suggestedQueries: [
      "Dissect the flaws in this article: https://www.theblogstarter.com/?msclkid=4ca46f0ad0f61074eb51087d079dc530",
      "Explain the true value of Groq API tools and whether they're as revolutionary as claimed: https://www.ampcome.com/post/how-to-use-groq-api-the-comprehensive-guide-you-need",
      "Analyze the new Gemini model: Is it really a breakthrough, or just more AI hype? https://blog.google/products/gemini/google-gemini-ai-collection-2024/",
    ],
  });
  const [chats, setChats] = useState<Chat[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const smartQuestionScore = calculateSmartQuestionScore(message);

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    loadChatHistory(currentChat.id);
    setChats([currentChat]);
  }, []);

  const loadChatHistory = async (chatId: string) => {
    try {
      const response = await fetch(`/api/chat?chatId=${chatId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.messages) {
          const existingChat = chats.find(chat => chat.id === chatId);
          if (existingChat) {
            const updatedChat = {
              ...existingChat,
              messages: data.messages || existingChat.messages,
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
      title: "New Chat",
      messages: [
        {
          role: "assistant",
          content: `
            **I won’t repeat myself — ask smart questions with URL sources or don’t ask at all.**
          `,
        },
      ],
      createdAt: new Date(),
      suggestedQueries: [
        "How can I phrase my question to get actionable insights, not just surface-level answers: https://fullfocus.co/asking-more-powerful-questions/",
        "Why does asking vague questions lead to wasted time, and how can I avoid it: https://www.thenarratologist.com/best-vague-questions/",
        "What are the key principles behind crafting questions that spark deep, meaningful discussions: https://www.insightandforesight.com.au/blog-foresights/mastering-the-art-of-asking-questions-simple-tips-for-success",
      ],
    };
    setChats(prev => [newChat, ...prev]);
    setCurrentChat(newChat);
  };

  const handleSendQuery = (query: string) => {
    setMessage(query);
    handleSend(query);
  };

  const handleSend = async (customMessage?: string) => {
    const messageToSend = customMessage || message;
    if (!messageToSend.trim()) return;
    setError(null);

    // Add user message to UI immediately
    const userMessage = { role: "user" as const, content: messageToSend };
    const updatedMessages = [...currentChat.messages, userMessage];

    const title =
      currentChat.messages.length === 1
        ? messageToSend.slice(0, 30) + "..."
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

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 429) {
          setError(
            `${errorData.message} Try again in ${errorData.timeRemaining} seconds.`
          );
          return;
        }
        throw new Error("Failed to send message");
      }

      const data = await response.json();

      // Add assistant's response
      const assistantMessage = {
        role: "assistant" as const,
        content: data.message,
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
      setError("Failed to send message. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChatSelect = (chat: Chat) => {
    // Clear the current chat state first
    setCurrentChat(chat);
    setMessage("");
    setError(null);
  };

  // Rest of your component remains exactly the same from here on
  return (
    <div className="flex h-screen bg-[#0000000]">
      {/* Sidebar */}
      <div className="w-60 bg-black border-r border-blue-900/30 flex flex-col bg-gradient-to-r from-gray-900 to-black p-2 backdrop-blur-lg shadow-md">
        <div className="p-1.5">
          <div className="flex items-center gap-2 px-4 py-2">
            <a
              href="https://haumanaexchange.org/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img src="/images/LOGO.png" alt="HEX Logo" className="h-9" />
            </a>

            <div className="border-blue-900/30">
              <button
                onClick={handleNewChat}
                className="text-sm flex items-center gap-2 text-white bg-blue-900/30 hover:bg-blue-800/40 transition-colors rounded-lg px-4 py-2 w-full"
              >
                <PlusIcon size={14} />
                <span>New Chat</span>
              </button>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {chats.map(chat => (
            <button
              key={chat.id}
              onClick={() => handleChatSelect(chat)}
              className={`w-full rounded text-left px-4 py-3 hover:bg-blue-900/30 transition-colors ${
                currentChat.id === chat.id ? "" : ""
              }`}
            >
              <h3 className="text-sm text-blue-200 truncate">{chat.title}</h3>
              <p className="text-xs text-blue-400/60">
                {new Date(chat.createdAt).toLocaleDateString()}
              </p>
            </button>
          ))}
        </div>
        <div className="p-3.5 border-blue-900/30">
          <div className="flex items-center gap-2 px-4 py-2 text-blue-400/60 text-sm">
            <span>Built for the Critically Inept</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col bg-gradient-to-br from-black via-black to-blue-900/20">
        {/* Header */}
        <header className="w-full bg-black/50 border-b border-blue-900/30 p-4 backdrop-blur-sm">
          <div className="max-w-4xl mx-auto flex items-center gap-4">
            <BrainIcon className="h-6 w-6 text-cyan-500" aria-hidden="true" />
            <h1 className="text-2xl font-bold text-blue-300 tracking-wide">
              CutTheFluff - URL Analyzer
            </h1>
            <div className="flex-1 ml-auto max-w-xs">
              <div className="bg-black/40 rounded-lg p-2 border border-blue-900/30 backdrop-blur-sm">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-blue-300">
                    Smart Question Score
                  </span>
                  <span
                    className={`text-sm font-mono p-2 ${
                      smartQuestionScore === 0
                        ? "text-blue-400/60"
                        : "text-cyan-400"
                    }`}
                  >
                    {smartQuestionScore}/100
                  </span>
                </div>
                <div className="h-2 bg-blue-900/20 rounded-full overflow-hidden">
                  <div
                    className="h-full transition-all duration-300 ease-out"
                    style={{
                      width: `${smartQuestionScore}%`,
                      background: `linear-gradient(90deg, 
                    ${
                      smartQuestionScore < 30
                        ? "#ef4444"
                        : smartQuestionScore < 50
                          ? "#eab308"
                          : smartQuestionScore < 70
                            ? "#3b82f6"
                            : "#22c55e"
                    }
                    , ${smartQuestionScore < 70 ? "#1e40af" : "#15803d"})`,
                    }}
                  />
                </div>
                <p
                  className={`text-xs mt-2 ${getMeterDescription(smartQuestionScore).color}`}
                >
                  {getMeterDescription(smartQuestionScore).text}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto pb-32 pt-4">
          <div className="max-w-3xl mx-auto px-4">
            {currentChat.messages.map((msg, index) => (
              <div
                key={index}
                className={`flex gap-4 mb-4 ${
                  msg.role === "assistant"
                    ? "justify-start"
                    : "justify-end flex-row"
                }`}
              >
                {msg.role === "assistant" && (
                  <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <BrainIcon className="h-5 w-5 text-cyan-500" />
                  </div>
                )}
                <div
                  className={`px-4 py-2 rounded-2xl max-w-[80%] whitespace-pre-wrap ${
                    msg.role === "assistant"
                      ? "bg-blue-900/20 border border-blue-900/30 text-blue-100"
                      : "bg-blue-600/30 text-blue-100"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div className="prose prose-invert max-w-none">
                      {msg.content.split("\n").map((line, i) => {
                        // First check if it's a numbered line
                        const numberMatch = line.match(/^(\d+)\.\s*(.*)/);

                        if (numberMatch) {
                          const [, number, content] = numberMatch;
                          // Then check if the content has asterisks
                          const asteriskContent =
                            content.match(/^\s*\*\*(.*?)\*\*:/);

                          if (asteriskContent) {
                            // Handle numbered line with asterisk content
                            return (
                              <div
                                key={i}
                                className="flex items-start gap-4 mb-6"
                              >
                                <span className="text-blue-400 font-bold min-w-[2rem] mt-[2px]">
                                  {number}.
                                </span>
                                <div className="flex-1">
                                  <span className="text-blue-300 font-bold">
                                    {asteriskContent[1]}:
                                  </span>
                                  <span className="block mt-2">
                                    {content.replace(/^\s*\*\*.*?\*\*:\s*/, "")}
                                  </span>
                                </div>
                              </div>
                            );
                          } else {
                            // Regular numbered line
                            return (
                              <div
                                key={i}
                                className="flex items-start gap-4 mb-6"
                              >
                                <span className="text-blue-400 font-bold min-w-[2rem] mt-[2px]">
                                  {number}.
                                </span>
                                <span className="flex-1">{content}</span>
                              </div>
                            );
                          }
                        }

                        // Handle standalone headers with **Header**
                        if (
                          line.trim().startsWith("**") &&
                          line.trim().endsWith("**") &&
                          !line.trim().includes(":")
                        ) {
                          const headerText = line
                            .trim()
                            .replace(/^\*\*|\*\*$/g, "");
                          return (
                            <div
                              key={i}
                              className="text-blue-300 font-bold text-2xl mb-4"
                            >
                              {headerText}
                            </div>
                          );
                        }

                        // Regular text, replace **Text** with <strong>Text</strong>
                        const formattedLine = line.replace(
                          /\*\*(.*?)\*\*/g,
                          "<strong>$1</strong>"
                        );

                        return line.trim() ? (
                          <div
                            key={i}
                            className="mb-4"
                            dangerouslySetInnerHTML={{ __html: formattedLine }}
                          />
                        ) : (
                          <div key={i} className="h-4" />
                        );
                      })}
                    </div>
                  ) : (
                    // User messages remain simple
                    <div>{msg.content}</div>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-4 mb-4">
                <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center animate-pulse">
                  <BrainIcon className="h-5 w-5 text-cyan-500" />
                </div>
                <div className="px-4 py-4 rounded-2xl bg-blue-900/20 border border-blue-900/30 text-blue-100 animate-pulse">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                  </div>
                </div>
              </div>
            )}
            {error && (
              <div className="flex justify-center mb-4">
                <div className="px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
                  {error}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Show suggested queries only if it's a new chat */}
        {currentChat.messages.length === 1 && currentChat.suggestedQueries && (
          <div className="flex flex-wrap gap-2 mt-4 mb-4 justify-center">
            {currentChat.suggestedQueries.map((query, index) => {
              const trimmedQuery = query.trim(); // Trim each query before use
              const displayText =
                trimmedQuery.length > 30
                  ? trimmedQuery.substring(0, 30) + "..."
                  : trimmedQuery;
              return (
                <button
                  key={index}
                  onClick={() => handleSendQuery(trimmedQuery)}
                  className="px-4 py-2 rounded-full bg-blue-900/20 border border-blue-900/30 text-blue-300 hover:bg-blue-800/30 transition-colors text-sm"
                >
                  {displayText}
                </button>
              );
            })}
          </div>
        )}

        {/* Input Area */}
        <div className="bottom-0 w-full bg-black/50 border-t border-blue-900/30 p-4 backdrop-blur-sm">
          <div className="mx-auto">
            <div className="flex gap-3 items-center">
              <input
                type="text"
                value={message}
                onChange={e => setMessage(e.target.value)}
                onKeyPress={e => e.key === "Enter" && handleSend()}
                placeholder="Type your message..."
                className="flex-1 rounded-xl border border-blue-900/30 bg-blue-900/20 px-4 py-3 text-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-blue-400/60"
              />
              <button
                onClick={() => handleSend()}
                disabled={isLoading}
                className="bg-blue-600/80 text-white px-5 py-3 rounded-xl hover:bg-blue-700/80 transition-all disabled:bg-blue-800/50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? <SendIcon size={20} /> : <SendIcon size={20} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
