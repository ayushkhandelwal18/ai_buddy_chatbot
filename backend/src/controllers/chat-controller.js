import User from '../models/user.model.js';
import { googleAI } from '../config/geminiconfig.js';

// Node 22 me fetch built-in hai

export const generateChatCompletion = async (
  req, res, next
) => {
  const { message } = req.body;

  try {
    const user = await User.findById(res.locals.jwtData.id);
    if (!user) {
      return res.status(401).json({ message: "User not registered OR Token malfunctioned" });
    }

    const chats = user.chats.map(({ role, content }) => ({ role, content }));
    chats.push({ role: "user", content: message });
    user.chats.push({ role: "user", content: message });

    // Gemini 2.5 Flash
   const geminiModel = googleAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        maxOutputTokens: 2048, // more space for code
        temperature: 0.6,      // more deterministic
      }
    });
const prompt = `
You are AI-Buddy, not a generic AI model.  
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
   - Use plain text only.  
   - Do not use bold, italics, markdown, or asterisks (*, **, etc.).  
   - For lists, use dashes (-) or numbers (1., 2., 3.) without any extra symbols.  
   - For code, wrap inside triple backticks (\`\`\`) with language name if applicable. 
   -Give answer in paragraphs or structured points, as relevant. 
4. Maintain a tone that is professional, friendly, and easy to follow.
5. Avoid unnecessary repetition or filler — stay focused and helpful.
6. Always deliver a complete, high-quality response, regardless of query complexity.

💡 Remember: Stay helpful, versatile, and clear.  
You are AI-Buddy, the personal AI companion created by Ayush Khandelwal. Respond only in plain text with proper structure and without markdown formatting.
User query: ${message}
`;



   const result = await geminiModel.generateContent(prompt);
    const reply = result.response.text() || "Sorry, no reply.";

    user.chats.push({ role: "assistant", content: reply });
    await user.save();

    return res.status(200).json({ chats: user.chats.slice(-10) }); // use to show last 10 messages
  } catch (error) {
    console.error("Gemini Error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// -------------------- Send All Chats --------------------
export const sendALLChatstoUSer = async (
  req,
  res,
  next
) => {
  try {
    const user = await User.findById(res.locals.jwtData.id);
    if (!user) {
      return res.status(401).send("User not registered OR Token malfunctioned");
    }
    if (user._id.toString() !== res.locals.jwtData.id) {
      return res.status(401).send("Permissions didn't match");
    }

    const limit = parseInt(req.query.limit) || 10;
    const skip = parseInt(req.query.skip) || 0;
    const totalChats = user.chats.length;
    const start = Math.max(0, totalChats - skip - limit);
    const end = Math.max(0, totalChats - skip);
    const slicedChats = user.chats.slice(start, end);

    return res.status(200).json({ 
      message: "OK", 
      chats: slicedChats, 
      hasMore: start > 0 
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "ERROR", cause: error.message });
  }
};

// -------------------- Delete User Chats --------------------
export const deleteUserChats = async (
  req,
  res,
  next
) => {
  try {
    const user = await User.findById(res.locals.jwtData.id);
    if (!user) {
      return res.status(401).send("User not registered OR Token malfunctioned");
    }
    if (user._id.toString() !== res.locals.jwtData.id) {
      return res.status(401).send("Permissions didn't match");
    }

    // 1️Clear chats
    user.chats = [];
    await user.save();

    return res.status(200).json({ message: "OK" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "ERROR", cause: error.message });
  }
};
