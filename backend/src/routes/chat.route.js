import {Router } from "express";
import { verifyToken } from "../utils/token-manager.js";
import { chatCompleteValidator, validate } from "../utils/validators.js";
import { generateChatCompletion, sendALLChatstoUSer,deleteUserChats } from "../controllers/chat-controller.js";


const chatRoutes = Router();

chatRoutes.post("/new" ,
    validate(chatCompleteValidator) ,
    verifyToken,
    generateChatCompletion);


    chatRoutes.get("/all-chats",
    verifyToken,
    sendALLChatstoUSer
    )

    chatRoutes.delete("/delete",
    verifyToken,
    deleteUserChats
    )

export default chatRoutes;
