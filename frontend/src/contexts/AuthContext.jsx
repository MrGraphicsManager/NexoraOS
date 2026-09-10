import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "../lib/api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [cafe, setCafe] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const token = localStorage.getItem("nx_token");
    if (!token) { setUser(false); setLoading(false); return; }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data.user); setCafe(data.cafe);
    } catch { setUser(false); localStorage.removeItem("nx_token"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("nx_token", data.token);
    await refresh();
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem("nx_token");
    setUser(false); setCafe(null);
  };

  const setTokenAndUser = async (token) => {
    localStorage.setItem("nx_token", token);
    await refresh();
  };

  return (
    <AuthCtx.Provider value={{ user, cafe, loading, login, logout, refresh, setTokenAndUser }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
