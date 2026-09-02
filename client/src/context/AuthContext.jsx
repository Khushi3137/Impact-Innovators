import { createContext, useEffect, useState } from "react";
import axios from "axios";

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const API_URL = "https://impact-innovators.onrender.com/api/auth";

  /* ---------------- Load user on refresh ---------------- */
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      setUser({ token });
    }
    setLoading(false);
  }, []);

  /* ---------------- LOGIN ---------------- */
  const login = async (email, password) => {
    const res = await axios.post(`${API_URL}/login`, {
      email,
      password,
    });

    localStorage.setItem("token", res.data.token);
    setUser(res.data.user);
  };

  /* ---------------- REGISTER ---------------- */
  const register = async (data) => {
    // This now sends the registration data to Render
    const res = await axios.post(`${API_URL}/register`, data);

    // If your backend auto-logs them in or returns a status
    if (res.data.token) {
      localStorage.setItem("token", res.data.token);
      setUser(res.data.user);
    }

    return res.data;
  };

  /* ---------------- LOGOUT ---------------- */
  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};