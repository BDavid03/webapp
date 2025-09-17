import { createContext, useContext, useEffect, useMemo, useState } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  const USERS_KEY = "app_users_v1";
  const SESSION_KEY = "app_session_v1";

  useEffect(() => {
    try {
      // Ensure default admin account exists
      try {
        const usersRaw = localStorage.getItem(USERS_KEY) || "{}";
        const users = JSON.parse(usersRaw);
        if (!users["admin"]) {
          const user = {
            id: crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`,
            username: "admin",
            password: "password12",
            createdAt: Date.now(),
            profile: { displayName: "Admin", avatarDataUrl: "" },
          };
          users["admin"] = user;
          localStorage.setItem(USERS_KEY, JSON.stringify(users));
        }
      } catch (_) {}

      const session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
      if (session?.userId) {
        const users = JSON.parse(localStorage.getItem(USERS_KEY) || "{}");
        const user = Object.values(users).find((u) => u.id === session.userId) || null;
        if (user) {
          setCurrentUser(user);
          setAuthed(true);
        } else {
          setAuthed(false);
        }
      } else {
        setAuthed(false);
      }
    } catch (_) {
      setAuthed(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const value = useMemo(
    () => ({
      authed,
      loading,
      currentUser,
      signUp: (username, password, profile = {}) => {
        const uname = String(username || "").trim();
        const pwd = String(password || "");
        if (!uname || !pwd) return { ok: false, error: "Username and password required" };
        try {
          const users = JSON.parse(localStorage.getItem(USERS_KEY) || "{}");
          const key = uname.toLowerCase();
          if (users[key]) return { ok: false, error: "User already exists" };
          const user = {
            id: crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`,
            username: uname,
            password: pwd, // local-only demo app
            createdAt: Date.now(),
            profile: { displayName: profile.displayName || "", avatarDataUrl: profile.avatarDataUrl || "" },
          };
          users[key] = user;
          localStorage.setItem(USERS_KEY, JSON.stringify(users));
          localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: user.id }));
          setCurrentUser(user);
          setAuthed(true);
          return { ok: true };
        } catch (e) {
          return { ok: false, error: "Failed to save user" };
        }
      },
      login: (username, password) => {
        const uname = String(username || "").trim();
        const pwd = String(password || "");
        try {
          const users = JSON.parse(localStorage.getItem(USERS_KEY) || "{}");
          const user = users[uname.toLowerCase()];
          const ok = !!user && user.password === pwd;
          if (ok) {
            localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: user.id }));
            setCurrentUser(user);
            setAuthed(true);
          }
          return ok;
        } catch (_) {
          return false;
        }
      },
      logout: () => {
        setAuthed(false);
        setCurrentUser(null);
        try { localStorage.removeItem(SESSION_KEY); } catch (_) {}
      },
    }),
    [authed, loading, currentUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
