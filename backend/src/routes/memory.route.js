import { Router } from "express";
import { verifyToken } from "../utils/token-manager.js";
import { getUserMemories, deleteUserMemory, clearUserMemories, updateMemorySettings } from "../controllers/memory.controller.js";

const memoryRoutes = Router();
memoryRoutes.use(verifyToken);
memoryRoutes.get("/", getUserMemories);
memoryRoutes.patch("/settings", updateMemorySettings);
memoryRoutes.delete("/", clearUserMemories);
memoryRoutes.delete("/:id", deleteUserMemory);
export default memoryRoutes;
