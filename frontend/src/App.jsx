import Header from "./components/Header";
import {Routes , Route} from "react-router-dom";
import Home from "./Pages/Home";
import Chat from "./Pages/Chat";
import Login from "./Pages/Login";
import SignUp from "./Pages/Signup";
import { useAuth } from "./context/AuthContent";
import Notfound from "./Pages/Notfound";



function App() {
  const auth = useAuth();
 
 

  return ( <main>
    <Header />
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<SignUp />} />

      {auth?.isLoggedIn && auth.user &&
      (<Route path="/chat" element={<Chat />} />)}

      <Route path="*" element={<Notfound />} />

      
      
    </Routes>
  </main>
  );
  
}

export default App
