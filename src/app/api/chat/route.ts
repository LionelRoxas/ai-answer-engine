/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { getGroqResponse } from "@/app/utils/groqClient";
import {
  scrapeUrl,
  urlPattern,
  saveConversation,
  getConversation,
} from "@/app/utils/scraper";

type MessageImage = {
  id: string;
  src: string;
  alt: string;
  caption?: string;
  width?: number;
  height?: number;
};

// Enhanced type for tracking conversation context
type ConversationContext = {
  state: string;
  stepNumber: number;
  attemptedEmails: string[];
  stuckIndicators: number;
  lastSuccessfulStep: number;
  userSentiment: "positive" | "neutral" | "frustrated";
};

// UHCC Non-Credit Portal Knowledge Base
const UHCC_PORTAL_KNOWLEDGE = {
  reset_process: {
    overview: "The UHCC portal reset process follows these exact 6 steps:",
    step1: {
      name: "Email Validation",
      action:
        "Go to 'I am a new user' section on RIGHT SIDE and enter your email",
      goal: "Verify your email exists in the system",
      success_indicator:
        "Get validation error about 'existing student record' (this is GOOD!)",
      failure_indicator:
        "Contact Information page appears (means email not in system - try different email)",
      page_url: "https://ce.uhcc.hawaii.edu/portal/logon.do?method=load",
    },
    step2: {
      name: "Username Reset Request",
      action:
        "Go to 'I am an existing user' on LEFT side and click Forgot Username link to enter the SAME validated email",
      goal: "Request username to be sent to your email",
      success_indicator: "System confirms username reset email was sent",
      prerequisite: "Must have validated email from Step 1",
    },
    step3: {
      name: "Retrieve Username",
      action: "Check your email inbox and spam folder for UHCC username email",
      goal: "Find your username in the email from UHCC",
      success_indicator: "You receive and find your username in the email",
      troubleshooting:
        "Check spam folder, wait a few minutes, verify correct email address",
    },
    step4: {
      name: "Password Reset Request",
      action:
        "Go to Forgot Password page and enter your username from the email",
      goal: "Request password reset link to be sent to your email",
      success_indicator: "System confirms password reset email was sent",
      prerequisite: "Must have username from Step 3",
    },
    step5: {
      name: "Reset Password",
      action:
        "Check email for password reset link and follow instructions to set new password",
      goal: "Set your new password using the reset link",
      success_indicator: "Successfully set new password",
      troubleshooting: "Check spam folder, ensure reset link hasn't expired",
    },
    step6: {
      name: "Login Complete",
      action:
        "Log in on LEFT SIDE ('I am an existing user') with username + new password",
      goal: "Successfully access your UHCC portal account",
      success_indicator: "Successfully logged into portal",
      page_url: "https://ce.uhcc.hawaii.edu/portal/logon.do?method=load",
    },
  },
  validation_messages: {
    good_validation_error: {
      typical_message:
        "We have found an existing student record in our database with a preferred email address that matches the one you have provided",
      meaning:
        "EXCELLENT! Your email IS in the system - proceed to Step 2 (Forgot Username)",
      action: "This is exactly what we want to see - move to next step",
    },
    bad_outcome: {
      indicator:
        "Contact Information form appears asking for name, address, phone, etc.",
      meaning: "Your email is NOT in the system",
      action:
        "Try different email addresses you might have used when first registering",
    },
  },
  portal_sections: {
    left_side: {
      name: "I am an existing user",
      when_to_use:
        "ONLY after you have both username AND new password (Step 6)",
      purpose: "Final login with recovered credentials",
    },
    right_side: {
      name: "I am a new user",
      when_to_use: "Step 1 only - to validate your email exists in system",
      purpose:
        "Email validation check (you're not actually creating new account)",
    },
  },
  urls: {
    main_portal: "https://ce.uhcc.hawaii.edu/portal/logon.do?method=load",
  },
  contact_info: {
    phone: "808-842-2563",
    email: "uhcccewd@hawaii.edu",
    hours: "Mon-Fri 8AM-3PM",
    formatted: "📞 808-842-2563\n📧 uhcccewd@hawaii.edu\n🕒 Mon-Fri 8AM-3PM",
  },
};

// Enhanced STEP_IMAGES with intelligent mapping
const STEP_IMAGES = {
  initial: {
    id: "portal_login",
    src: "/images/steps/portal-login-page.png",
    alt: "UHCC Portal Login Page",
    caption: "The main UHCC portal login page",
    keywords: ["portal", "login page", "main", "start", "beginning"],
    stepNumber: 0,
  },
  has_login_error: {
    id: "login_error",
    src: "/images/steps/login-error.png",
    alt: "Login error message",
    caption: "This is what you see when you get a login error",
    keywords: ["error", "invalid", "locked", "can't login", "problem"],
    stepNumber: 1,
  },
  checking_email_validation: {
    id: "new_user_section",
    src: "/images/steps/new-user-section.PNG",
    alt: "I am a new user section",
    caption: "RIGHT SIDE: 'I am a new user' section for email validation",
    keywords: ["new user", "right side", "email check", "validation"],
    stepNumber: 1,
  },
  email_validated_ready_for_username: {
    id: "validation_error_good",
    src: "/images/steps/validation-error-success.png",
    alt: "Good validation error message",
    caption:
      "After putting your email on the 'I am a new user' section, you should get this message. This validation error means your email IS in the system! ✅",
    keywords: [
      "validation error",
      "existing student",
      "email found",
      "success",
    ],
    stepNumber: 2,
  },
  username_email_sent: {
    id: "check_email",
    src: "/images/steps/check-email-inbox.PNG",
    alt: "Check email inbox",
    caption: "Check both inbox and spam folder for username email",
    keywords: ["check email", "inbox", "spam", "username email"],
    stepNumber: 3,
  },
  ready_for_password_reset: {
    id: "forgot_password_page",
    src: "/images/steps/forgot-password-page.PNG",
    alt: "Forgot Password page",
    caption:
      "Click this link, then enter your username to get password reset link",
    keywords: ["forgot password", "username", "password reset"],
    stepNumber: 4,
  },
  password_reset_in_progress: {
    id: "password_reset_email",
    src: "/images/steps/password-reset-email.PNG",
    alt: "Password reset email",
    caption: "Check your inbox again, then click the reset link in your email",
    keywords: ["reset link", "password email", "reset password"],
    stepNumber: 5,
  },
  process_complete: {
    id: "login_success",
    src: "/images/steps/login-success.PNG",
    alt: "Successful login",
    caption: "Success! You're now logged into the portal",
    keywords: ["success", "logged in", "complete", "dashboard"],
    stepNumber: 6,
  },
};

// Additional context-specific images
const CONTEXTUAL_IMAGES = {
  contact_form: {
    id: "contact_form_error",
    src: "/images/steps/contact-form-error.png",
    alt: "Contact form appears",
    caption:
      "If you see this contact form, your email is NOT in the system - try a different email",
    keywords: ["contact form", "email not found", "wrong email"],
  },
  spam_folder: {
    id: "spam_folder_check",
    src: "/images/steps/spam-folder-check.PNG",
    alt: "Check spam folder",
    caption: "Always check your spam/junk folder for UHCC emails",
    keywords: ["spam", "junk", "not receiving", "no email"],
  },
  forgot_username_link: {
    id: "forgot_username_location",
    src: "/images/steps/forgot-username-location.PNG",
    alt: "Forgot Username link location",
    caption:
      "Click 'Forgot Username' on the LEFT side after validating your email",
    keywords: ["forgot username", "left side", "username link"],
  },
};

// Intelligent image selector based on context
function selectBestImage(
  context: ConversationContext,
  aiResponse: string,
  userMessage: string,
  pageContext: string
): MessageImage {
  const combinedContext =
    `${aiResponse} ${userMessage} ${pageContext}`.toLowerCase();

  // Priority 1: Direct instruction matching
  // Check what the AI is actually telling the user to do RIGHT NOW
  const instructionPatterns = [
    {
      patterns: [
        "i am a new user",
        "right side",
        "check if your email",
        "test your email",
        "enter your email",
        "try a different email",
        "test a different email",
      ],
      image: STEP_IMAGES.checking_email_validation,
    },
    {
      patterns: [
        "validation error",
        "existing student record",
        "email is in the system",
        "that's exactly what we wanted",
      ],
      image: STEP_IMAGES.email_validated_ready_for_username,
    },
    {
      patterns: [
        "forgot username",
        'click "forgot username"',
        "go back to the left side",
        "i am an existing user",
      ],
      image: CONTEXTUAL_IMAGES.forgot_username_link,
    },
    {
      patterns: [
        "check your email",
        "check your inbox",
        "spam folder",
        "username email",
        "find your username",
      ],
      image: STEP_IMAGES.username_email_sent,
    },
    {
      patterns: [
        "forgot password",
        "password reset",
        "enter the username",
        "enter your username",
      ],
      image: STEP_IMAGES.ready_for_password_reset,
    },
    {
      patterns: [
        "reset link",
        "password reset email",
        "set your new password",
        "click the reset link",
      ],
      image: STEP_IMAGES.password_reset_in_progress,
    },
    {
      patterns: [
        "contact form",
        "email isn't in the system",
        "email not found",
        "try different email",
      ],
      image: CONTEXTUAL_IMAGES.contact_form,
    },
    {
      patterns: ["successfully", "logged in", "you're all set", "success!"],
      image: STEP_IMAGES.process_complete,
    },
    {
      patterns: ["login error", "getting an error", "can't log in"],
      image: STEP_IMAGES.has_login_error,
    },
  ];

  // Check each pattern group in order
  for (const patternGroup of instructionPatterns) {
    for (const pattern of patternGroup.patterns) {
      if (combinedContext.includes(pattern)) {
        return patternGroup.image;
      }
    }
  }

  // Priority 2: Check contextual images
  for (const image of Object.values(CONTEXTUAL_IMAGES)) {
    if (image.keywords.some(keyword => combinedContext.includes(keyword))) {
      return image;
    }
  }

  // Priority 3: State-based fallback
  const stateImage = STEP_IMAGES[context.state as keyof typeof STEP_IMAGES];
  if (stateImage) {
    return stateImage;
  }

  // Priority 4: Default to initial
  return STEP_IMAGES.initial;
}

// Enhanced state detection that better tracks back-and-forth movement
function analyzeUserState(messages: any[]): ConversationContext {
  const context: ConversationContext = {
    state: "initial",
    stepNumber: 0,
    attemptedEmails: [],
    stuckIndicators: 0,
    lastSuccessfulStep: 0,
    userSentiment: "neutral",
  };

  const allMessages = messages
    .map(m => m.content?.toLowerCase() || "")
    .join(" ");

  const messageHistory = messages.map(m => m.content?.toLowerCase() || "");
  const lastFewMessages = messageHistory.slice(-3).join(" ");

  // Get the most recent AI message to understand current instruction
  const lastAIMessage =
    messages
      .filter(m => m.role === "assistant")
      .pop()
      ?.content?.toLowerCase() || "";

  // Extract attempted emails
  messages.forEach(msg => {
    const emailMatches = msg.content?.match(
      /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/g
    );
    if (emailMatches) {
      emailMatches.forEach((email: string) => {
        if (!context.attemptedEmails.includes(email.toLowerCase())) {
          context.attemptedEmails.push(email.toLowerCase());
        }
      });
    }
  });

  // Analyze sentiment and stuck patterns
  const frustrationIndicators = [
    "not working",
    "still not",
    "nothing",
    "can't find",
    "help",
    "frustrated",
    "stuck",
    "doesn't work",
    "tried everything",
  ];

  frustrationIndicators.forEach(indicator => {
    if (lastFewMessages.includes(indicator)) {
      context.stuckIndicators++;
    }
  });

  if (context.stuckIndicators >= 3) {
    context.userSentiment = "frustrated";
  } else if (
    lastFewMessages.includes("great") ||
    lastFewMessages.includes("thanks") ||
    lastFewMessages.includes("perfect")
  ) {
    context.userSentiment = "positive";
  }

  // Determine current step based on what AI is currently instructing
  if (
    lastAIMessage.includes("i am a new user") ||
    lastAIMessage.includes("right side") ||
    lastAIMessage.includes("test your email") ||
    lastAIMessage.includes("try a different email")
  ) {
    context.state = "checking_email_validation";
    context.stepNumber = 1;
  } else if (
    lastAIMessage.includes("validation error") &&
    lastAIMessage.includes("excellent")
  ) {
    context.state = "email_validated_ready_for_username";
    context.stepNumber = 2;
  } else if (
    lastAIMessage.includes("forgot username") ||
    lastAIMessage.includes("left side")
  ) {
    context.state = "email_validated_ready_for_username";
    context.stepNumber = 2;
  } else if (
    lastAIMessage.includes("check your email") &&
    lastAIMessage.includes("username")
  ) {
    context.state = "username_email_sent";
    context.stepNumber = 3;
  } else if (lastAIMessage.includes("forgot password")) {
    context.state = "ready_for_password_reset";
    context.stepNumber = 4;
  } else if (
    lastAIMessage.includes("reset link") ||
    lastAIMessage.includes("password reset email")
  ) {
    context.state = "password_reset_in_progress";
    context.stepNumber = 5;
  } else if (
    lastAIMessage.includes("success") &&
    lastAIMessage.includes("logged")
  ) {
    context.state = "process_complete";
    context.stepNumber = 6;
  }

  // Check for restart scenarios
  if (
    lastFewMessages.includes("start over") ||
    lastFewMessages.includes("try different email") ||
    lastFewMessages.includes("wrong email") ||
    lastFewMessages.includes("contact form") ||
    (lastAIMessage.includes("different email") &&
      lastAIMessage.includes("i am a new user"))
  ) {
    context.state = "restart_needed";
    // Keep the step number at 1 since we're going back to email validation
    context.stepNumber = 1;
  }

  // Original user response patterns for state detection
  if (!context.state || context.state === "initial") {
    if (
      allMessages.includes("successfully") &&
      (allMessages.includes("logged in") ||
        allMessages.includes("reset password") ||
        allMessages.includes("i'm in") ||
        allMessages.includes("it worked"))
    ) {
      context.state = "process_complete";
      context.stepNumber = 6;
      context.lastSuccessfulStep = 6;
    } else if (
      allMessages.includes("password reset") &&
      (allMessages.includes("email") ||
        allMessages.includes("link") ||
        allMessages.includes("got the reset"))
    ) {
      context.state = "password_reset_in_progress";
      context.stepNumber = 5;
      context.lastSuccessfulStep = 4;
    } else if (
      allMessages.includes("got my username") ||
      allMessages.includes("have username") ||
      allMessages.includes("received username") ||
      allMessages.includes("found my username")
    ) {
      context.state = "ready_for_password_reset";
      context.stepNumber = 4;
      context.lastSuccessfulStep = 3;
    } else if (
      allMessages.includes("existing student record") ||
      allMessages.includes("validation error") ||
      allMessages.includes("email exists")
    ) {
      context.state = "email_validated_ready_for_username";
      context.stepNumber = 2;
      context.lastSuccessfulStep = 1;
    } else if (
      allMessages.includes("invalid email") ||
      allMessages.includes("invalid password") ||
      allMessages.includes("login error") ||
      allMessages.includes("can't log in")
    ) {
      context.state = "has_login_error";
      context.stepNumber = 1;
    }
  }

  return context;
}

// Enhanced response generation with sentiment awareness
async function generateAIExpectedOutcomes(
  aiResponse: string,
  currentContext: ConversationContext,
  conversationHistory: any[]
): Promise<any> {
  // Check if the AI response includes contact info - if so, don't show options
  if (aiResponse.includes("📞") || aiResponse.includes("contact:")) {
    return { showInput: false };
  }

  // Analyze the AI's response more intelligently
  const lowerResponse = aiResponse.toLowerCase();
  const isAskingQuestion = aiResponse.includes("?");
  const isGivingInstructions =
    lowerResponse.includes("go to") ||
    lowerResponse.includes("check your") ||
    lowerResponse.includes("click") ||
    lowerResponse.includes("enter");

  // If not asking a question or giving instructions, just show regular input
  if (!isAskingQuestion && !isGivingInstructions) {
    return { showInput: true };
  }

  // Extract the key question or action from the AI response
  const sentences = aiResponse.split(/[.!?]/).filter(s => s.trim());
  const lastQuestion = sentences.find(s => s.includes("?"))?.trim() || "";
  const keyAction =
    sentences
      .find(
        s =>
          s.toLowerCase().includes("check") ||
          s.toLowerCase().includes("what") ||
          s.toLowerCase().includes("did") ||
          s.toLowerCase().includes("have")
      )
      ?.trim() || "";

  const outcomePrompt = `You are generating simple, natural response options for a user in a UHCC portal support conversation.

CURRENT CONTEXT:
- User State: ${currentContext.state}
- Step Number: ${currentContext.stepNumber}
- User Sentiment: ${currentContext.userSentiment}
- Stuck Indicators: ${currentContext.stuckIndicators}
- Attempted Emails: ${currentContext.attemptedEmails.length}
- AI's Question/Action: "${lastQuestion || keyAction}"
- Full AI Response: "${aiResponse}"

CONVERSATION HISTORY (last 3 exchanges):
${conversationHistory
  .slice(-6)
  .map(msg => `${msg.role}: ${msg.content}`)
  .join("\n")}

UHCC PORTAL KNOWLEDGE:
${JSON.stringify(UHCC_PORTAL_KNOWLEDGE, null, 2)}

RULES FOR GENERATING OPTIONS:
1. Generate 2-4 SHORT, NATURAL user responses (5-15 words max)
2. Write from the user's perspective only
3. Match the specific context of where the user is in the 6-step process
4. Include realistic outcomes based on the portal's actual behavior
5. Always include a "try different email" option when stuck on email-related steps
6. If user sentiment is frustrated, include a "I need help" option
7. Always include a "Where is it?" option if the AI is telling them to look for the Forgot Username link or Forgot Password link
8. Always have a positive outcome option like "Found it!" or "Trying now" if the AI is asking about checking email or finding something

RESPONSE PATTERNS BY QUESTION TYPE:
- "What happens when...?" → What the user sees/experiences
- "Did you find...?" → "Found it!" / "Not yet" / "Nothing in spam"
- "Have you tried...?" → "Yes" / "Trying now" / "Didn't work"
- "What message appears?" → Actual messages user might see
- "How did that go?" → Success/failure outcomes

CONTEXT-SPECIFIC OPTIONS:
- Step 1 (Email validation): Focus on validation error vs contact form
- Step 2-3 (Username): Focus on email receipt and spam checking
- Step 4-5 (Password): Focus on reset link and completion
- Any step with issues: Include "Try different email?" option

FORMAT AS JSON:
{
  "options": [
    {
      "id": "option1",
      "text": "Short natural response",
      "action": "Short natural response",
      "color": "appropriate-color-classes"
    }
  ]
}

COLORS:
- Green: Success/positive ("bg-green-50 border-green-200 hover:border-green-400")
- Yellow: Neutral/waiting ("bg-yellow-50 border-yellow-200 hover:border-yellow-400")
- Red: Error/problem ("bg-red-50 border-red-200 hover:border-red-400")
- Blue: Action/trying ("bg-blue-50 border-blue-200 hover:border-blue-400")

Generate ONLY the JSON, no explanations.`;

  try {
    const outcomeMessages = [
      { role: "system" as const, content: outcomePrompt },
      {
        role: "user" as const,
        content: "Generate natural response options for this situation.",
      },
    ];

    const outcomeResponse = await getGroqResponse(outcomeMessages);

    let cleanedResponse = "";
    try {
      // Clean the response by removing markdown code blocks and extra text
      cleanedResponse = (outcomeResponse ?? "").trim();

      // Remove markdown code block markers
      cleanedResponse = cleanedResponse.replace(/^```json\s*/i, "");
      cleanedResponse = cleanedResponse.replace(/^```\s*/, "");
      cleanedResponse = cleanedResponse.replace(/\s*```$/i, "");

      // Try to find JSON content between curly braces
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedResponse = jsonMatch[0];
      }

      const parsedOutcomes = JSON.parse(cleanedResponse);

      // Validate and enhance the outcomes
      if (parsedOutcomes.options && Array.isArray(parsedOutcomes.options)) {
        // Limit to 4 options max and ensure quality
        parsedOutcomes.options = parsedOutcomes.options
          .slice(0, 4)
          .map((opt: any) => ({
            ...opt,
            text: opt.text.substring(0, 50),
            action: opt.text.substring(0, 50), // Ensure they match
          }));

        // Add intelligence: if no "different email" option exists and user might be stuck
        const hasEmailOption = parsedOutcomes.options.some((opt: any) =>
          opt.text.toLowerCase().includes("email")
        );

        if (
          !hasEmailOption &&
          (currentContext.state.includes("email") ||
            currentContext.state.includes("validation")) &&
          currentContext.stuckIndicators > 1
        ) {
          parsedOutcomes.options.push({
            id: "different_email",
            text: "Try different email?",
            action: "Try different email?",
            color: "bg-blue-50 border-blue-200 hover:border-blue-400",
          });
        }

        // Add help option if user is frustrated
        if (
          currentContext.userSentiment === "frustrated" &&
          !parsedOutcomes.options.some((opt: any) =>
            opt.text.toLowerCase().includes("help")
          )
        ) {
          parsedOutcomes.options.push({
            id: "need_help",
            text: "I need help",
            action: "I need help",
            color: "bg-purple-50 border-purple-200 hover:border-purple-400",
          });
        }
      }

      return parsedOutcomes;
    } catch (parseError) {
      console.error("Failed to parse AI-generated outcomes:", parseError);
      console.error("Raw AI response:", outcomeResponse);
      console.error("Cleaned response:", cleanedResponse);
      return getIntelligentFallbackOptions(currentContext, aiResponse);
    }
  } catch (error) {
    console.error("Error generating AI outcomes:", error);
    return getIntelligentFallbackOptions(currentContext, aiResponse);
  }
}

// Enhanced intelligent fallback options
function getIntelligentFallbackOptions(
  context: ConversationContext,
  aiResponse: string
): any {
  const lowerResponse = aiResponse.toLowerCase();

  // Analyze what the AI is asking about
  if (
    lowerResponse.includes("what happens") ||
    lowerResponse.includes("what message")
  ) {
    if (
      context.state.includes("validation") ||
      context.state.includes("email")
    ) {
      return {
        options: [
          {
            id: "success",
            text: "Got validation error!",
            action: "Got validation error!",
            color: "bg-green-50 border-green-200 hover:border-green-400",
          },
          {
            id: "fail",
            text: "Shows contact form",
            action: "Shows contact form",
            color: "bg-red-50 border-red-200 hover:border-red-400",
          },
          {
            id: "different",
            text: "Try different email?",
            action: "Try different email?",
            color: "bg-blue-50 border-blue-200 hover:border-blue-400",
          },
        ],
      };
    }
  }

  if (
    lowerResponse.includes("did you find") ||
    lowerResponse.includes("check your email")
  ) {
    return {
      options: [
        {
          id: "found",
          text: "Found it!",
          action: "Found it!",
          color: "bg-green-50 border-green-200 hover:border-green-400",
        },
        {
          id: "not_yet",
          text: "Nothing yet",
          action: "Nothing yet",
          color: "bg-yellow-50 border-yellow-200 hover:border-yellow-400",
        },
        {
          id: "spam",
          text: "Not in spam either",
          action: "Not in spam either",
          color: "bg-red-50 border-red-200 hover:border-red-400",
        },
      ],
    };
  }

  if (lowerResponse.includes("have you") || lowerResponse.includes("did you")) {
    const options = [
      {
        id: "yes",
        text: "Yes",
        action: "Yes",
        color: "bg-green-50 border-green-200 hover:border-green-400",
      },
      {
        id: "no",
        text: "Not yet",
        action: "Not yet",
        color: "bg-yellow-50 border-yellow-200 hover:border-yellow-400",
      },
      {
        id: "tried",
        text: "Tried but didn't work",
        action: "Tried but didn't work",
        color: "bg-red-50 border-red-200 hover:border-red-400",
      },
    ];

    // Add help option if frustrated
    if (context.userSentiment === "frustrated") {
      options.push({
        id: "help",
        text: "I need help",
        action: "I need help",
        color: "bg-purple-50 border-purple-200 hover:border-purple-400",
      });
    }

    return { options };
  }

  // Default to text input if no good match
  return { showInput: true };
}

// Enhanced response generation for each state
function getResponseForState(
  state: string,
  context?: ConversationContext
): {
  message: string;
  image?: MessageImage;
} {
  const image = STEP_IMAGES[state as keyof typeof STEP_IMAGES];

  // Add sentiment-aware modifications
  const sentimentPrefix =
    context?.userSentiment === "frustrated"
      ? "I understand this is frustrating, but don't worry - "
      : "";

  switch (state) {
    case "initial":
      return {
        message: `Hey there! I'm here to help you get back into your UHCC continuing education account.

What's happening when you try to log in? Are you getting some kind of error message?

**Quick tip:** If you're getting a login error, we'll start by checking if your email's in the system using the "I am a new user" section on the <a href="https://ce.uhcc.hawaii.edu/portal/logon.do?method=load" target="_blank">portal login page</a>.`,
        image,
      };

    case "has_login_error":
      return {
        message: `${sentimentPrefix}I see you're getting a login error - that's frustrating! Don't worry, we can fix this with a simple 6-step process.

First, let's check if your email is in the system. Go to the <a href="https://ce.uhcc.hawaii.edu/portal/logon.do?method=load" target="_blank">portal login page</a> and look for the RIGHT SIDE where it says "I am a new user" - click there and enter your email.

What happens when you do that?`,
        image,
      };

    case "checking_email_validation":
      return {
        message: `Perfect! You're testing your email in the "I am a new user" section.

Remember, we want to see a validation error here - that means your email IS in the system. If it just asks for contact info, your email isn't registered.

What message appears after you enter your email?`,
        image,
      };

    case "email_validated_ready_for_username":
      return {
        message: `🎉 **EXCELLENT!** That validation error is exactly what we wanted! Your email IS in the system.

Now for Step 2: Go back to the LEFT side ("I am an existing user") and click "Forgot Username". Enter that same email address. The system will send your username to your email.

Have you tried that yet?`,
        image,
      };

    case "username_email_sent":
      return {
        message: `Great! Step 3 now: Check your email inbox and spam folder for the username email from UHCC.

Once you find your username in that email, we'll move to Step 4 (password reset).

Did you find the email with your username?`,
        image,
      };

    case "ready_for_password_reset":
      return {
        message: `Perfect! Now for Step 4: Go to the "Forgot Password" page and enter the username you just got from your email.

This will send a password reset link to your email for Step 5.

How did that go?`,
        image,
      };

    case "password_reset_in_progress":
      return {
        message: `Almost there! Step 5: Check your email (and spam folder) for the password reset email from UHCC.

Click the reset link in that email and set your new password. After that, you can log in on the LEFT side ("I am an existing user") of the <a href="https://ce.uhcc.hawaii.edu/portal/logon.do?method=load" target="_blank">portal login page</a> with your username and new password.

Were you able to reset your password?`,
        image,
      };

    case "restart_needed":
      const emailList = context?.attemptedEmails?.length
        ? `\n\nYou've tried: ${context.attemptedEmails.join(", ")}`
        : "";

      return {
        message: `${sentimentPrefix}No problem! Let's start fresh with a different email address.

Sometimes the email you think you used isn't the one in the system. Let's go back to Step 1 and try a different email.${emailList}

Go to the <a href="https://ce.uhcc.hawaii.edu/portal/logon.do?method=load" target="_blank">portal login page</a> and use the "I am a new user" section on the RIGHT SIDE to test a different email address.

What other email addresses might you have used when you first registered?`,
        image: CONTEXTUAL_IMAGES.contact_form, // Show contact form image when restarting
      };

    case "process_complete":
      return {
        message: `🎉 **SUCCESS!** You're all set! You can now log in anytime using:
• Username: (from the first email)
• Password: (your new password)

Just use the LEFT side ("I am an existing user") of the <a href="https://ce.uhcc.hawaii.edu/portal/logon.do?method=load" target="_blank">portal login page</a>.

Is there anything else I can help you with?`,
        image,
      };

    default:
      return {
        message: `Hey! I'm here to help with UHCC portal login issues. What's happening when you try to log in?

If this is about something other than portal login problems, please contact:

${UHCC_PORTAL_KNOWLEDGE.contact_info.formatted}`,
        image,
      };
  }
}

export async function POST(req: Request) {
  try {
    const { message, messages, chatId } = await req.json();

    if (!message?.trim()) {
      const initialResponse = getResponseForState("initial");
      return NextResponse.json({
        message: initialResponse.message,
        image: initialResponse.image,
        showInput: true,
      });
    }

    const url = message.match(urlPattern);
    const userQuery = message.replace(url ? url[0] : "", "").trim();

    // Get enhanced context based on conversation history
    const conversationContext = analyzeUserState(messages);
    const stateResponse = getResponseForState(
      conversationContext.state,
      conversationContext
    );
    let pageContext = "";

    if (url) {
      console.log("URL found:", url[0]);
      const pageData = await scrapeUrl(url[0]);

      if (pageData && pageData.content) {
        console.log("Page content retrieved");

        // Analyze what page they're showing us
        const content = pageData.content.toLowerCase();

        if (
          content.includes("validation error") &&
          content.includes("invalid email")
        ) {
          pageContext =
            "I can see you're getting the validation error about invalid email/password. ";
        } else if (content.includes("existing student record")) {
          pageContext =
            "Perfect! I can see the page is telling you there's an existing student record - that's exactly what we want! ";
        } else if (content.includes("forgot") && content.includes("username")) {
          pageContext = "Good, you're on the forgot username page. ";
        } else if (content.includes("forgot") && content.includes("password")) {
          pageContext = "Great, you're on the forgot password page. ";
        } else if (content.includes("reset") && content.includes("password")) {
          pageContext = "I see you're on the password reset page. ";
        } else if (content.includes("login") || content.includes("logon")) {
          pageContext = "I can see the login page. ";
        } else if (content.includes("contact information")) {
          pageContext =
            "I see the contact information form - this means your email isn't in the system yet. ";
        }
      } else {
        pageContext = "I couldn't access that page, but I can still help! ";
      }
    }

    // Create intelligent system context with full conversation history and knowledge base
    const systemPrompt = `You are an expert UHCC portal support specialist. You're helping students recover their login credentials with warmth, patience, and expertise.

CORE BEHAVIOR PRINCIPLES:
- Be conversational and encouraging - talk like you're helping a friend
- Keep responses focused and brief (2-3 sentences max) 
- Guide users step-by-step through the process without overwhelming them
- Always validate their progress and celebrate small wins
- Recognize frustration and offer alternative approaches
- Remember the ENTIRE conversation context to provide personalized help
- Use natural language with contractions and casual tone

CURRENT USER CONTEXT:
- State: ${conversationContext.state}
- Step Number: ${conversationContext.stepNumber} of 6
- User Sentiment: ${conversationContext.userSentiment}
- Stuck Indicators: ${conversationContext.stuckIndicators}
- Attempted Emails: ${conversationContext.attemptedEmails.join(", ") || "none yet"}
- Last Successful Step: ${conversationContext.lastSuccessfulStep}
${pageContext ? `- Page Context: ${pageContext}` : ""}

THE 6-STEP UHCC PORTAL RESET PROCESS:
1. Email Validation: "I am a new user" section (RIGHT side) → validation error = GOOD (email exists)
2. Username Reset: "I am an existing user" section (LEFT side) → Forgot Username → email sent
3. Get Username: Check email/spam → find username from UHCC
4. Password Reset: Forgot Password page → enter username → reset email sent
5. Reset Password: Check email/spam → click reset link → create new password
6. Login Success: LEFT side with username + new password

CRITICAL UNDERSTANDING:
- Validation error in Step 1 = SUCCESS (email is in system)
- Contact form in Step 1 = FAILURE (email not in system, try different email)
- Users often use wrong email - always offer to try different emails
- Emails often go to spam - always remind to check spam folder
- Some users get stuck in loops - recognize patterns and suggest restart

SENTIMENT-AWARE RESPONSES:
- If frustrated: Acknowledge frustration, be extra encouraging, offer direct help
- If positive: Match their energy, celebrate progress
- If neutral: Stay helpful and guide to next step

RESPONSE GUIDELINES:
- Only mention the step number they're currently on
- One clear action or question per response
- Acknowledge what they just told you before giving next step
- If stuck, always suggest trying a different email
- For technical issues beyond login, provide contact info immediately

PORTAL URL RULE:
- ONLY use: <a href="https://ce.uhcc.hawaii.edu/portal/logon.do?method=load" target="_blank">portal login page</a>
- Never provide any other URLs or links

CONTACT INFO TRIGGERS:
Immediately provide contact info for:
- Course registration, billing, grades, schedules
- Technical issues beyond portal login
- Policy questions or academic issues
- Any non-login related queries

Contact: 
📞 808-842-2563
📧 uhcccewd@hawaii.edu
🕒 Mon-Fri 8AM-3PM

UHCC PORTAL KNOWLEDGE BASE:
${JSON.stringify(UHCC_PORTAL_KNOWLEDGE, null, 2)}

FULL CONVERSATION HISTORY:
${messages.map((msg: any, index: number) => `${index + 1}. ${msg.role}: ${msg.content}`).join("\n")}

Remember: You're an expert who cares about helping students succeed. Be warm, patient, and solution-focused.`;

    // Build complete message history for AI
    const aiMessages = [
      { role: "system" as const, content: systemPrompt },
      ...messages.map((msg: any) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
      { role: "user" as const, content: userQuery },
    ];

    const aiResponse = await getGroqResponse(aiMessages);
    const finalResponse = aiResponse || stateResponse.message;

    // Select the best image based on full context
    const selectedImage = selectBestImage(
      conversationContext,
      finalResponse,
      message,
      pageContext
    );

    // Generate intelligent expected outcomes
    const expectedOutcomes = await generateAIExpectedOutcomes(
      finalResponse,
      conversationContext,
      messages
    );

    // Save conversation with enhanced context
    const updatedMessages = [
      ...messages,
      { role: "user", content: message },
      {
        role: "assistant",
        content: finalResponse,
        image: selectedImage,
        context: conversationContext, // Save context for debugging
      },
    ];

    await saveConversation(chatId, updatedMessages);

    return NextResponse.json({
      message: finalResponse,
      image: selectedImage, // Use intelligently selected image
      ...expectedOutcomes,
      debug: {
        state: conversationContext.state,
        step: conversationContext.stepNumber,
        sentiment: conversationContext.userSentiment,
        attemptedEmails: conversationContext.attemptedEmails.length,
      },
    });
  } catch (error) {
    console.error("Error in portal support:", error);
    return NextResponse.json(
      {
        message: `I'm having some technical trouble right now. For immediate help with your login issue, please contact:

📞 808-842-2563
📧 uhcccewd@hawaii.edu
🕒 Mon-Fri 8AM-3PM

They'll be able to help you get back into your account right away!`,
        showInput: false,
      },
      { status: 500 }
    );
  }
}

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
