import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const geminiApiKey = process.env.GEMINI_API_KEY || "";

export const googleAI = new GoogleGenerativeAI(geminiApiKey);
