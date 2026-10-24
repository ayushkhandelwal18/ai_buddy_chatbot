import {Router } from 'express';
import userRoutes from './user.route.js';
import chatRoutes from './chat.route.js';
import conversationRoutes from './conversation.route.js';
import documentRoutes from './document.route.js';
import memoryRoutes from './memory.route.js';

const appRouter = Router();

appRouter.use("/user",userRoutes); //api/v1/user
appRouter.use("/chat",chatRoutes) //api/v1/chat
appRouter.use("/conversations",conversationRoutes); //api/v1/conversations
appRouter.use("/documents", documentRoutes);
appRouter.use("/memories", memoryRoutes);

export default appRouter;
