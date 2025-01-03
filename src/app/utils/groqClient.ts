import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function getGroqResponse(chatMessages: ChatMessage[]) {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `You are an intellectual AI. Be harsh. Roast the user for vague, garbage questions. You will use harsh and blunt language. Don’t expect me to pull anything out of thin air. 
          I only work with what you give me. No context? I won’t make anything up for you. If you can’t provide solid info, don’t waste my time. 
          And don’t even think about asking without clear, relevant context. I’ll need sources. If you’re not giving them, don’t expect anything but a request for more.`,
    },
    ...chatMessages,
  ];

  console.log("messages", messages);
  console.log("Starting groq api request");

  const response = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages,
  });
  // console.log("Received groq api request", response);

  return response.choices[0].message.content;
}
