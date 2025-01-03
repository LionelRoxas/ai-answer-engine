import { NextResponse } from "next/server";
import { getGroqResponse } from "@/app/utils/groqClient";
import {
  scrapeUrl,
  urlPattern,
  saveConversation,
  getConversation,
} from "@/app/utils/scraper";

export async function POST(req: Request) {
  try {
    const { message, messages, chatId } = await req.json();
    const url = message.match(urlPattern); // Match URL in the message
    const userQuery = message.replace(url ? url[0] : "", "").trim();

    // Check if the same query was sent recently
    const previousMessages = messages.slice(-2); // Get the last two messages
    const previousUserMessage = previousMessages[previousMessages.length - 2];
    const previousQuery = previousUserMessage
      ? previousUserMessage.content
      : "";

    if (userQuery === previousQuery) {
      return NextResponse.json({
        message:
          "I have no time for repetitive questions. Let's move on to something new.",
      });
    }

    let userPrompt;

    // Roast the user’s original query first
    const roast = `
**Really? This is what you're bringing to the table?**
Let’s break this down:
- A vague question with no depth.
- An unprepared attempt with no real substance.
- A waste of both our time.

I get it — not everyone knows how to ask a proper question. But you need to step up your game if you want something worth my time. Don’t expect me to just throw out random responses based on nonsense.

**Your Original Query:**
"${message}"

That’s cute, but it’s not cutting it. Let’s fix this, and I’ll show you how it’s done.`;

    if (url) {
      // If a valid URL is found, scrape it and analyze its content
      console.log("URL found:", url[0]);
      const scraperResponse = await scrapeUrl(url[0]);

      if (scraperResponse && scraperResponse.content) {
        // Successfully scraped content
        console.log("Content successfully scraped");
        userPrompt = `
${roast}
Alright, now that we got the nonsense out of the way, let’s dive in.

You asked for an analysis. I’m not here for fluff. I’m here to dissect this — tear it apart. Here’s what I’m doing:

- Exposing weak logic
- Ripping apart every fallacy
- Pointing out unsupported claims

URL Analyzed: ${url[0]}
User’s Query: "${userQuery}"

Content to Dissect:
${scraperResponse.content}

Structure your response like this:
**Critical Analysis**
[Go to town on the arguments]

**Counterpoints**
[Dissect and challenge each point]

**Devil's Advocate**
[Flip it. Challenge every assumption]

**Verdict**
[Call it like you see it – no holds barred]

Now, let’s get real. I’m not here to pat you on the back. If it’s weak, I’m calling it out. If it’s nonsense, I’m exposing it. No apologies.`;
      } else {
        // If the URL's content couldn't be scraped
        userPrompt = `
${roast}
That link you gave me? Absolute garbage. It’s either blocked, dead, or hiding behind some digital wall. You can't expect me to work with nothing.

**The Problem**
Your link is:
- Blocked
- Dead
- Locked behind a wall
- Or it's one of those paranoid websites

**What to Do Next**
1. Find a link that actually works.
2. Paste the raw text of what you want me to analyze.
3. Rethink your approach to providing information.

Your query: "${userQuery}"? It’s irrelevant until you give me something I can work with.`;
      }
    } else {
      // If no URL is provided, roast the user for lack of context
      userPrompt = `
${roast}
No URL, no content. Just this vague, empty question? Let’s get real — I’m not here to entertain lazy queries. 

**What You Need to Do**
I don’t deal with fluff. I need depth. A clear query. A URL. Don’t make me ask again. 

**Better Ways to Ask:**
- “Can you break down this article on climate change? Here’s the link: [URL]”
- “Explain why this argument on AI ethics falls apart: [URL]”

Until you give me a proper URL and context, we’re at a standstill. Don’t waste my time with generic questions, and get me what I need.`;
    }

    // Send the user message to the LLM
    const llmMessages = [...messages, { role: "user", content: userPrompt }];
    const response = await getGroqResponse(llmMessages);

    if (!response) {
      throw new Error("Failed to get a response from the LLM service");
    }

    const formattedResponse = response.trim();

    // Save the updated conversation to Redis
    const updatedMessages = [
      ...messages,
      { role: "user", content: message },
      { role: "assistant", content: formattedResponse },
    ];

    await saveConversation(chatId, updatedMessages);

    return NextResponse.json({ message: formattedResponse });
  } catch (error) {
    console.error("Error in chat API:", error);
    return NextResponse.json(
      {
        message:
          "Something broke. Either your URL is problematic, or the system's having a moment. Try again, but maybe with a URL that actually works this time.",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Add a new GET endpoint to retrieve chat history
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const chatId = searchParams.get("chatId");

    if (!chatId) {
      return NextResponse.json(
        { error: "Chat ID is required" },
        { status: 400 }
      );
    }

    const conversation = await getConversation(chatId);
    return NextResponse.json({ messages: conversation });
  } catch (error) {
    console.error("Error retrieving chat history:", error);
    return NextResponse.json(
      { error: "Failed to retrieve chat history" },
      { status: 500 }
    );
  }
}
