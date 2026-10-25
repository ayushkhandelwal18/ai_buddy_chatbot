import jwt from "jsonwebtoken";
import { COOKIE_NAME } from "./constant.js";

export const createToken = (id, email, expiresIn) =>
  jwt.sign({ id, email }, process.env.JWT_SECRET, { expiresIn });

export const verifyToken = (req, res, next) => {
  const token = req.signedCookies?.[COOKIE_NAME];
  if (typeof token !== "string" || !token.trim()) {
    return res.status(401).json({ message: "Please log in to continue." });
  }
  let identity;
  try { identity = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] }); }
  catch { return res.status(401).json({ message: "Your session has expired or is invalid. Please log in again." }); }
  if (!identity || typeof identity !== "object" || typeof identity.id !== "string" ||
      !/^[a-f\d]{24}$/i.test(identity.id) || typeof identity.email !== "string") {
    return res.status(401).json({ message: "Invalid session. Please log in again." });
  }
  res.locals.jwtData = identity;
  return next();
};
