import express from 'express';
import './config/rag.config.js';
import appRouter from './routes/index.route.js'; // Importing the router
import cookieParser from 'cookie-parser';
import cors from "cors";
import { notFoundHandler, errorHandler } from './middleware/error.middleware.js';

const app = express();

// Middleware 
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  })
);


app.use(express.json({ limit: "1mb" }));
app.use(cookieParser(process.env.COOKIE_SECRET));

app.use("/api/v1",appRouter);

// Unknown route + centralised error handling (must stay last).
app.use(notFoundHandler);
app.use(errorHandler);


export default app;
