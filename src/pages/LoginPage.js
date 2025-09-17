import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import "./LoginPage.css";

export default function LoginPage() {
  const [mode, setMode] = useState("login"); // 'login' | 'signup'
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const { login, signUp } = useAuth();

  const from = location.state?.from?.pathname || "/";

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password) {
      setError("Enter username and password");
      return;
    }
    if (mode === "signup") {
      const res = signUp(username, password);
      if (res.ok) navigate(from, { replace: true });
      else setError(res.error || "Could not sign up");
    } else {
      const ok = login(username, password);
      if (ok) navigate(from, { replace: true });
      else setError("Incorrect username or password");
    }
  };

  return (
    <div className="login">
      <div className="login__card">
        <h1>{mode === "signup" ? "Create Account" : "Log In"}</h1>
        <form onSubmit={handleSubmit} className="login__form">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit">{mode === "signup" ? "Sign Up" : "Log In"}</button>
        </form>
        {error && <p className="login__error">{error}</p>}
        <p className="login__hint">Default admin: <code>admin</code> / <code>password12</code></p>
        <div className="login__hint">
          {mode === "login" ? (
            <button className="login__link" onClick={() => { setMode("signup"); setError(""); }}>Need an account? Sign up</button>
          ) : (
            <button className="login__link" onClick={() => { setMode("login"); setError(""); }}>Have an account? Log in</button>
          )}
        </div>
      </div>
    </div>
  );
}
