import User from "../models/user.model.js";
import { hash, compare } from "bcrypt";
import { createToken } from "../utils/token-manager.js";
import { COOKIE_NAME } from "../utils/constant.js";

const cookieOptions = () => ({
  path: "/", httpOnly: true, signed: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
});
const publicUser = (user) => ({ name: user.name, email: user.email });
const authUnavailable = (res, error) => {
  // Database errors can contain credentials or submitted values.
  console.error("[auth] Operation unavailable", { name: error?.name, code: typeof error?.code === "number" ? error.code : undefined });
  return res.status(503).json({ message: "Authentication is temporarily unavailable. Please try again later." });
};
const issueSession = (res, user) => {
  const token = createToken(String(user._id), user.email, "7d");
  res.cookie(COOKIE_NAME, token, { ...cookieOptions(), expires: new Date(Date.now() + 7 * 86400000) });
};
const emailPattern = (email) => "^" + email.replace(/[.*+?^\$\{\}()|[\]\\]/g, "\\$&") + "$";

const findUserByEmail = async (email, withPassword = false) => {
  const fields = withPassword ? "+password name email" : "name email";
  // Keep existing mixed-case accounts and their IDs. New accounts use lowercase.
  return await User.findOne({ email }).select(fields) ||
    await User.findOne({ email: { $regex: emailPattern(email), $options: "i" } }).select(fields);
};

// Retain the old route shape, but return only the authenticated account.
export const getAllUsers = async (req, res) => {
  try {
    const user = await User.findById(res.locals.jwtData.id).select("name email");
    if (!user) return res.status(401).json({ message: "Please sign in again." });
    return res.status(200).json({ status: "success", message: "Account fetched successfully", data: [{ id: String(user._id), ...publicUser(user) }] });
  } catch (error) { return authUnavailable(res, error); }
};

export const usersignup = async (req, res) => {
  try {
    const { name, password } = req.body;
    const email = req.body.email.toLowerCase();
    if (await findUserByEmail(email)) return res.status(409).json({ message: "An account with this email already exists. Please log in." });
    const user = await User.create({ name, email, password: await hash(password, 10) });
    issueSession(res, user);
    return res.status(201).json({ message: "Account created successfully", ...publicUser(user) });
  } catch (error) {
    // The unique email index also catches concurrent registrations.
    if (error.code === 11000) return res.status(409).json({ message: "An account with this email already exists. Please log in." });
    return authUnavailable(res, error);
  }
};

export const userlogin = async (req, res) => {
  try {
    const user = await findUserByEmail(req.body.email, true);
    if (!user || !await compare(req.body.password, user.password)) {
      return res.status(401).json({ message: "Email or password is incorrect." });
    }
    issueSession(res, user);
    // The JWT stays in the signed HTTP-only cookie, never in response JSON.
    return res.status(200).json({ message: "Login successful", ...publicUser(user) });
  } catch (error) { return authUnavailable(res, error); }
};

export const verifyUser = async (req, res) => {
  try {
    const user = await User.findById(res.locals.jwtData.id).select("name email");
    if (!user) return res.status(401).json({ message: "Please sign in again." });
    return res.status(200).json({ message: "OK", ...publicUser(user) });
  } catch (error) { return authUnavailable(res, error); }
};

export const userlogout = async (req, res) => {
  // Ending an already authenticated session does not require a database lookup.
  res.clearCookie(COOKIE_NAME, cookieOptions());
  return res.status(200).json({ message: "OK" });
};
