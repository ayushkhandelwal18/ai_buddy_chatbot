import Header from "./components/Header";
import { Routes, Route, useLocation } from "react-router-dom";
import Home from "./Pages/Home";
import Chat from "./Pages/Chat";
import Login from "./Pages/Login";
import SignUp from "./Pages/Signup";
import Notfound from "./Pages/Notfound";



function App() {
  const location = useLocation();

  // The chat workspace provides its own top bar and needs the full viewport.
  const isChatRoute = location.pathname.startsWith("/chat");

  return (
    <main className={isChatRoute ? "app-shell app-shell--chat" : "app-shell"}>
      {!isChatRoute && <Header />}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />

        {/* The chat page guards itself and redirects to /login when needed. */}
        <Route path="/chat" element={<Chat />} />
        <Route path="/chat/:conversationId" element={<Chat />} />

        <Route path="*" element={<Notfound />} />
      </Routes>
    </main>
  );
}

export default App
