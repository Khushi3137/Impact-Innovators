import { useEffect, useState } from "react";
import { getProfile, login as loginRequest, register as registerRequest } from "../api/authApi";
import { AuthContext } from "./authContextValue";

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      const token = localStorage.getItem("token");

      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const data = await getProfile();
        setUser(data.user);
      } catch {
        localStorage.removeItem("token");
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const login = async (email, password) => {
    const data = await loginRequest({ email, password });

    localStorage.setItem("token", data.token);
    setUser(data.user);
    return data;
  };

  const register = async (data) => {
    const result = await registerRequest(data);

    if (result.token) {
      localStorage.setItem("token", result.token);
      setUser(result.user);
    }

    return result;
  };

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
