import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function getGroqResponse(chatMessages: ChatMessage[]) {
  // console.log("Starting groq api request");
  // console.log("messages", chatMessages);

  try {
    const response = await groq.chat.completions.create({
      // Using the most capable production model available
      model: "llama-3.3-70b-versatile", // Much smarter than llama-3.1-8b-instant
      messages: chatMessages,
      temperature: 0.7, // Balanced creativity
      top_p: 0.9, // Focused but diverse responses
    });

    // console.log("Received groq api response");
    return response.choices[0].message.content;
  } catch (error) {
    console.error("Groq API error:", error);
    
    // Return null on error so your route.ts can handle it
    return null;
  }
}