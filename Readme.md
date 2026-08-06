# 🤖 AI‑Buddy

A smart, reliable, and friendly AI chatbot built with the **MERN stack** + **Gemini API**. Handles all kinds of queries—general, coding, math, science, recipes, explanations, and more.

---

## ✨ Features

- Custom **user authentication & authorization**
- Data validation with **express-validator** middleware
- **MongoDB** storage for user chats
- **Paginated chat loading** (loads the last 10 messages by default, with a "Load Older Messages" button to load more in chunks)
- **JWT** tokens & **HTTP‑Only cookies** for secure auth
- **Auth-protected routes** with custom middleware
- Modern **React** frontend (Vite + JavaScript + SWC)
- Beautiful, responsive chat UI (**Material UI**)
- **React Hot Toast** for in-app feedback
- **React Icons** for iconography
- **React Syntax Highlighter** for code answers
- **React Type Animation** for typing effects

> **Bonus:** Clean, maintainable codebase, sensible folder structure, production‑ready configurations.

---

## 🧰 Tech Stack

**Frontend:**  
React · Vite · JavaScript · Material UI · React Hot Toast · React Icons · React Syntax Highlighter · React Type Animation

**Backend:**  
Node.js · Express.js · JavaScript (ES Modules) · express‑validator · cookie‑parser · JWT

**Database:**  
MongoDB Atlas (via Mongoose)

**AI:**  
Google Gemini API

---

## 🗂️ Project Structure

```bash
AI-Buddy/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── db/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── utils/
│   │   └── index.js, app.js
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── context/
│   │   ├── helpers/
│   │   ├── pages/
│   │   └── App.jsx, App.css, main.jsx, index.css
│   ├── index.html
│   └── package.json
│
└── README.md
```

---

## 🔐 Environment Variables

Create a `.env` file inside the **backend** folder:

```env
PORT=3000
MONGO_URL=your_mongodb_connection_string
JWT_SECRET=super_secret_key
COOKIE_SECRET=another_secret_if_used
GEMINI_API_KEY=your_gemini_api_key
FRONTEND_URL=http://localhost:5173
```

Create a `.env` file inside the **frontend** folder:

```env
VITE_API_URL=http://localhost:3000/api/v1
```

---

## ⚙️ Installation & Setup

```bash
# 1) Clone the repo
git clone https://github.com/ayushkhandelwal18/AI-Chat-Bot.git
cd AI-Chat-Bot

# 2) Backend setup
cd backend
npm install
npm start

# 3) Frontend setup
cd ../frontend
npm install
npm run dev
```

---

## 🔑 Authentication Flow (JWT + HTTP‑Only Cookies)

1. **Signup/Login:** Validates input with `express-validator`
2. On success: Issues a **JWT token** (set as HTTP‑Only cookie)
3. **Protected routes:** Check `req.cookies` → verify JWT → attach `req.user`
4. **Logout:** Clears cookie

---

## 🧪 API Endpoints 

**User Routes:**
- `POST   /api/v1/user/signup` &nbsp;–&nbsp; Register a new user
- `POST   /api/v1/user/login` &nbsp;–&nbsp; Login
- `GET    /api/v1/user/auth-status` &nbsp;–&nbsp; Check authentication status
- `GET    /api/v1/user/logout` &nbsp;–&nbsp; Logout and clear cookies

**Chat Routes:**
- `POST   /api/v1/chat/new` &nbsp;–&nbsp; Send a new chat message
- `GET    /api/v1/chat/all-chats` &nbsp;–&nbsp; Get all chats for logged-in user
- `DELETE /api/v1/chat/delete` &nbsp;–&nbsp; Delete all chats for logged-in user

---

## 🖥️ UI Highlights

- **MUI** components with responsive layout
- **React Hot Toast** for async feedback
- **Syntax highlighting** in code answers
- **Type animation** for branding and typing effects

---

## 🤝 Contributing

Pull requests are welcome!  
Feel free to open issues for suggestions or improvements.

---

## 🛠️ Customization

Change the prompt in `chat-controller.js` to personalize your chatbot’s behavior.

---
