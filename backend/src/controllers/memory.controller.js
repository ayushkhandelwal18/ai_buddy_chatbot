import { listMemories, deleteMemory, clearMemories, setMemoryEnabled } from "../services/memory.service.js";

export const getUserMemories = async (req, res) => res.status(200).json({
  message: "OK", ...await listMemories(res.locals.jwtData.id),
});

export const deleteUserMemory = async (req, res) => {
  await deleteMemory(res.locals.jwtData.id, req.params.id);
  return res.status(200).json({ message: "Memory deleted" });
};

export const clearUserMemories = async (req, res) => {
  await clearMemories(res.locals.jwtData.id);
  return res.status(200).json({ message: "Saved memories cleared" });
};

export const updateMemorySettings = async (req, res) => res.status(200).json({
  message: "Memory settings updated", ...await setMemoryEnabled(res.locals.jwtData.id, req.body?.enabled),
});
