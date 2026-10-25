import { createContext, useEffect, useState, useContext } from "react";
import { checkAuthStatus, loginUser, userLogout, signupUser } from "../helpers/api";
import toast from "react-hot-toast";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  useEffect(() => {
    let active = true;
    checkAuthStatus().then((data) => {
      if (active) { setUser({ email: data.email, name: data.name }); setIsLoggedIn(true); }
    }).catch(() => {
      if (active) { setUser(null); setIsLoggedIn(false); }
    }).finally(() => { if (active) setIsAuthLoading(false); });
    return () => { active = false; };
  }, []);

  const acceptSession = (data) => {
    setUser({ email: data.email, name: data.name });
    setIsLoggedIn(true);
    return data;
  };
  const login = async (email, password) => acceptSession(await loginUser(email, password));
  const signup = async (name, email, password) => acceptSession(await signupUser(name, email, password));
  const logout = async () => {
    try {
      await userLogout();
      setIsLoggedIn(false);
      setUser(null);
      window.location.reload();
    } catch (error) { toast.error(error.message || "Unable to log out. Please try again."); }
  };

  return <AuthContext.Provider value={{ user, isLoggedIn, isAuthLoading, login, signup, logout }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
