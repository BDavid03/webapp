import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import HomePage from "./pages/HomePage";
import CalculatorPage from "./pages/CalculatorPage";
import WeatherPage from "./pages/WeatherPage";
import ChessPage from "./pages/ChessPage";
import LoginPage from "./pages/LoginPage";
import AccountPage from "./pages/AccountPage";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import RequireAuth from "./auth/RequireAuth";
import "./App.css";

function Shell() {
  const { authed, loading } = useAuth();
  if (loading) return null;
  const shellClass = authed ? "app-shell app-shell--authed" : "app-shell";
  function RedirectToLogin() {
    const location = useLocation();
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return (
    <div className={shellClass}>
      {authed && <Navbar />}
      <main className="app-content">
        {authed ? (
          <Routes>
            <Route
              index
              element={
                <RequireAuth>
                  <HomePage />
                </RequireAuth>
              }
            />
            <Route path="login" element={<Navigate to="/" replace />} />
            <Route
              path="calculator"
              element={
                <RequireAuth>
                  <CalculatorPage />
                </RequireAuth>
              }
            />
            <Route
              path="account"
              element={
                <RequireAuth>
                  <AccountPage />
                </RequireAuth>
              }
            />
            <Route
              path="weather"
              element={
                <RequireAuth>
                  <WeatherPage />
                </RequireAuth>
              }
            />
            <Route
              path="chess"
              element={
                <RequireAuth>
                  <ChessPage />
                </RequireAuth>
              }
            />
          </Routes>
        ) : (
          <Routes>
            <Route path="login" element={<LoginPage />} />
            <Route path="*" element={<RedirectToLogin />} />
          </Routes>
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
