import mongoose from "mongoose";
import { randomUUID } from "crypto";

const chatsSchema = new mongoose.Schema({
  id: {
    type: String,
    default: randomUUID(),
  },
  role: {
    type: String,
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
});

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true, select: false },
  chats: [chatsSchema], //chatschema ko userschema ke sath link kara hai
});


export default mongoose.model("User" , userSchema); // Exporting the User model
