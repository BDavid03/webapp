import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import "./Navbar.css";

export default function Navbar() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };
  return (
    <header className="navbar">
      <div className="navbar__logo">David.com</div>
      <nav className="navbar__links">
        <NavLink end to="/" className="navbar__link">
          Home
        </NavLink>
        <NavLink to="/calculator" className="navbar__link">
          Calculator
        </NavLink>
        <NavLink to="/weather" className="navbar__link">
          Weather
        </NavLink>
        <NavLink to="/chess" className="navbar__link">
          Chess
        </NavLink>
        <NavLink to="/account" className="navbar__link">
          Account
        </NavLink>
        <button className="navbar__logout" onClick={handleLogout}>
          Log out
        </button>
      </nav>
    </header>
  );
}
