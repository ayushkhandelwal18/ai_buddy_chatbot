import { GoogleGenerativeAI } from "@google/generative-ai";
import "./rag.config.js";

const geminiApiKey = process.env.GEMINI_API_KEY || "";

export const googleAI = new GoogleGenerativeAI(geminiApiKey);
