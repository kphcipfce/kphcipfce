import { NavLink } from "react-router-dom";
import { IoIosLogOut } from "react-icons/io";
import { useAuth } from "../context/AuthContext";
import { roleLabel } from "../utils/roleLabel";
import logo from "../assets/logohcip.png";

export default function NavBar() {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <nav className="navbar">
      <img src={logo} alt="KP HCIP" className="brand-logo" />
      <div className="navbar-links">
        {user.role === "member" && (
          <>
            <NavLink to="/submit">Submit Activity</NavLink>
            <NavLink to="/my-team">My Team</NavLink>
          </>
        )}
        {user.role === "district_viewer" && <NavLink to="/my-activities">My Activities</NavLink>}
        {user.role === "grm_focal" && <NavLink to="/my-grm-activities">My Activities</NavLink>}
        {user.role !== "executive" && <NavLink to="/dashboard">Dashboard</NavLink>}
        {user.role === "super_admin" && <NavLink to="/admin">Admin</NavLink>}
        {user.role === "executive" && <NavLink to="/executive">Executive</NavLink>}
      </div>
      <span className="spacer" />
      <div className="who-block">
        <span className="who">
          {user.name} ({roleLabel(user.role)})
        </span>
        <span className="brand-tagline">Field Community Engagement</span>
      </div>
      <button className="btn-logout" onClick={logout}>
        <IoIosLogOut />
        Log out
      </button>
    </nav>
  );
}
