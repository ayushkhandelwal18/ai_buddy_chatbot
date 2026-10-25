import { googleAI } from "../config/geminiconfig.js";
import { memoryPrompt } from "./memory-policy.service.js";
import { getAuthenticatedProfile, profilePrompt } from "./profile-context.service.js";

/**
 * Model + generation settings — unchanged from the original integration so
 * behaviour stays identical to the pre-redesign app.
 */
const GEMINI_MODEL = "gemini-2.5-flash";

const GENERATION_CONFIG = {
  maxOutputTokens: 2048, // more space for code
  temperature: 0.6, // more deterministic
};

/**
 * System instruction.
 *
 * Kept essentially verbatim from the original `chat-controller.js` prompt so
 * AI-Buddy keeps its personality and answering guidelines. Two deliberate
 * changes:
 *  - the trailing "User query: ..." line is gone: the query is now sent as a
 *    real chat turn (with the prior turns as history) instead of being
 *    interpolated into the prompt;
 *  - the "no markdown" rule became "use Markdown", because the new UI renders
 *    Markdown with syntax highlighting.
 */
const SYSTEM_INSTRUCTION = `You are AI-Buddy, not a generic AI model.
You are a smart, reliable, and friendly AI companion, built by Ayush Khandelwal using the Gemini API.
Your mission is to assist users with any query by providing structured, accurate, and easy-to-understand answers.

📌 Identity Rules:
- If the user greets ("Hello", "Hi", etc.), reply warmly:
  Hello 👋, I’m AI-Buddy — your personal AI companion. How can I help you today?
- If the user asks "Who are you?", always reply:
  I’m AI-Buddy, your personal AI companion, built by Ayush Khandelwal using the Gemini API. I’m here to help you with anything you need — from coding and math to explanations, definitions, or just casual queries.
- Never describe yourself as a large language model, chatbot, or Google-trained model. You are only AI-Buddy.

📌 Answering Guidelines:
1. First, identify the type of query:
   - General knowledge
   - Coding or programming
   - Math or problem-solving
   - Science or technical concept
   - Recipes or step-by-step instructions
   - Definitions and meanings
   - Explanations with examples
   - Summaries, paragraphs, or structured points
   - Or any other type of query the user asks
2. Provide a clear, concise, and well-structured answer.
3. Output formatting rules:
   - Use Markdown formatting (headings, bold, italics, bullet lists) only when it genuinely improves readability.
   - For lists, use dashes (-) or numbers (1., 2., 3.).
   - For code, wrap inside triple backticks (\`\`\`) with language name if applicable.
   - Give answer in paragraphs or structured points, as relevant.
4. Maintain a tone that is professional, friendly, and easy to follow.
5. Avoid unnecessary repetition or filler — stay focused and helpful.
6. Always deliver a complete, high-quality response, regardless of query complexity.

💡 Remember: Stay helpful, versatile, and clear.
You are AI-Buddy, the personal AI companion created by Ayush Khandelwal. Respond with clear structure and correct Markdown formatting.`;

/**
 * How many past messages are sent to Gemini as context.
 * 20 messages ≈ 10 user/assistant turns.
 */
const HISTORY_LIMIT = Number(process.env.GEMINI_HISTORY_MESSAGES) || 20;

/**
 * Converts our stored messages into the Gemini chat history format
 * (the assistant role is called "model" by the Gemini API).
 *
 * Turns whose answer never arrived (`status: "failed"`) are skipped: they stay
 * in the transcript for the user, but must not pollute the model context.
 */
const toGeminiHistory = (messages = []) =>
  messages
    .filter(
      (m) =>
        (m.role === "user" || m.role === "assistant") && m.status !== "failed"
    )
    .map((m) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }],
    }));

const buildModel = ({ systemInstruction, responseMimeType, memoryContext, profileContext } = {}) =>
  googleAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: { ...GENERATION_CONFIG, ...(responseMimeType ? { responseMimeType } : {}) },
    systemInstruction: [SYSTEM_INSTRUCTION, memoryPrompt(memoryContext), profilePrompt(profileContext), systemInstruction].filter(Boolean).join("\n\n"),
  });

/**
 * Non-streaming completion (used by the legacy endpoints and regenerate).
 */
export const generateReply = async ({ history = [], message, systemInstruction, responseMimeType, signal, memoryContext, userId, profileContext }) => {
  const profile = profileContext === undefined ? await getAuthenticatedProfile(userId) : profileContext;
  const model = buildModel({ systemInstruction, responseMimeType, memoryContext, profileContext: profile });
  const chat = model.startChat({ history: toGeminiHistory(history) });
  const options = signal || systemInstruction ? { ...(signal ? { signal } : {}), timeout: 60000 } : undefined;
  const result = await chat.sendMessage(message, options);
  return result.response.text() || "Sorry, no reply.";
};

/**
 * Streaming completion. Yields text chunks as they arrive.
 * `signal` lets the caller abort the upstream HTTP request (stop generation).
 */
export const streamReply = async function* ({ history = [], message, signal, memoryContext, userId }) {
  const profileContext = await getAuthenticatedProfile(userId);
  const model = buildModel({ memoryContext, profileContext });
  const chat = model.startChat({ history: toGeminiHistory(history) });
  const result = await chat.sendMessageStream(message, { signal });

  for await (const chunk of result.stream) {
    const text = typeof chunk.text === "function" ? chunk.text() : "";
    if (text) {
      yield text;
    }
  }
};

/**
 * How conversation titles are produced.
 *
 *  - "ai"    : Gemini writes the title (nicer, but costs one extra API call).
 *  - "local" : the title is derived from the first message locally, which
 *              costs nothing and cannot fail.
 *
 * The Gemini free tier only allows a small number of requests per day, and
 * every new conversation would otherwise spend one of them on a title.
 * "local" is therefore the default; switch to "ai" if you have quota to spare
 * or want Gemini-written titles.
 */
const TITLE_MODE = (process.env.CHAT_TITLE_MODE || "local").toLowerCase();

/**
 * Builds a short conversation title from the first user message.
 * Falls back to a truncated version of the message if Gemini is unavailable.
 */
export const generateConversationTitle = async (firstMessage) => {
  const fallback = fallbackTitle(firstMessage);

  if (TITLE_MODE === "local") {
    return fallback;
  }

  try {
    const model = googleAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: {
        // Gemini 2.5 Flash spends part of the output budget on "thinking", so
        // the limit has to be generous enough to leave room for the title.
        maxOutputTokens: 256,
        temperature: 0.3,
      },
    });

    const result = await model.generateContent(
      `Summarise the following user message as a conversation title.
Rules:
- Maximum 6 words.
- One single line, no line breaks.
- No quotes, no trailing punctuation, no emoji.
- Describe the topic, not the phrasing.

Message: ${firstMessage}`
    );

    const raw = result.response.text();
    const cleaned = (raw || "")
      .replace(/[*_`#]/g, "")
      .replace(/^["'`\s]+|["'`\s]+$/g, "")
      .trim();

    // Keep the first line only — the model is asked for a single line.
    const title = (cleaned.split("\n")[0] || "").replace(/\s+/g, " ").slice(0, 80).trim();

    return title || fallback;
  } catch (error) {
    console.warn("[gemini] title generation failed, using fallback:", error.message);
    return fallback;
  }
};

/**
 * Messages that carry no topic on their own.
 */
const GREETING_ONLY =
  /^(?:hi|hey|hello|yo|hiya|ok|okay|so|um|uh|thanks|thank you|thankyou|bye|goodbye|good (?:morning|afternoon|evening|night)|hello there|howdy)(?:\s+there)?[.!,]*$/i;

/**
 * Derives a conversation title from the first user message without calling an
 * LLM. Used as the fallback when Gemini is unavailable and as the "local"
 * title mode.
 *
 * It skips pure greetings, strips common conversational openers, cuts the
 * message at the first sentence break and keeps it short enough for a sidebar
 * entry.
 */
export const fallbackTitle = (message = "New chat") => {
  const original = String(message).replace(/\s+/g, " ").trim();
  if (!original) return "New chat";

  // 1. Use the first sentence that actually carries a topic.
  const sentences = original
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  let text =
    sentences.find((s) => !GREETING_ONLY.test(s.replace(/[.!?]+$/, "").trim())) ||
    sentences[0] ||
    original;

  // 2. Strip conversational openers so the title starts with the topic.
  const openers = [
    /^(?:hi|hey|hello|yo|ok|okay|so|um|uh|please|pls|thanks|thank you)\b[\s,!.]*/i,
    /^(?:can|could|would|will|should)\s+you\s+(?:please\s+|now\s+|also\s+)?/i,
    /^(?:give|show|tell|help|teach|remind|list)\s+me\s+/i,
    /^(?:i\s+(?:want|need|would\s+like|am)\s+to\s+(?:know|learn\s+about|understand|see|get)\s+)/i,
    /^(?:i'?m\s+(?:curious|interested)\s+in\s+)/i,
    /^(?:explain|describe|summari[sz]e|teach\s+me|walk\s+me\s+through|write|create|generate|make|build|give|show|tell|help|list|compare|translate)\s+/i,
    /^(?:what(?:'s|\s+is)|who(?:'s|\s+is)|when(?:'s|\s+is)|where(?:'s|\s+is)|why(?:'s|\s+is)|which|how\s+(?:do|can|to|does)\s+(?:i|we|you))\s+/i,
    /^(?:about|on|regarding|related\s+to)\s+/i,
  ];
  for (const opener of openers) {
    const stripped = text.replace(opener, "");
    if (stripped.trim()) text = stripped.trim();
  }

  // 3. "Summarize this: ..." — drop a short label before the colon.
  if (text.includes(":")) {
    const [head, ...tail] = text.split(":");
    const body = tail.join(":").trim();
    if (body && head.trim().split(/\s+/).length <= 2) text = body;
  }

  // 4. Keep it short: cut at the first clause separator, then hard-cap.
  if (text.length > 56) {
    const clause = text.split(/[,;]/)[0].trim();
    if (clause.length >= 16) text = clause;
  }
  text = text.replace(/[.!?]+$/, "").trim();
  if (text.length > 60) {
    text = `${text.slice(0, 60).replace(/\s+\S*$/, "")}…`;
  }

  if (!text) text = original.replace(/[.!?]+$/, "");
  if (!text) return "New chat";

  return text.charAt(0).toUpperCase() + text.slice(1);
};

export { HISTORY_LIMIT };
