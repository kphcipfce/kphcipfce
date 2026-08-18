import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import Spinner from "../components/Spinner";
import logo from "../assets/logohcip.png";

export default function Login() {
  const { user, loading, login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  // Reaching /login while already signed in (browser back button, a stale bookmark, typing
  // the URL directly) should never show the form stacked underneath the still-live navbar —
  // send them straight back to their normal landing page instead. Wait for the initial
  // token check to finish first, or a valid session would flash the form before redirecting.
  if (loading) return <Spinner />;
  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await login(email, password);
      navigate("/", { replace: true });
    } catch (err) {
      showToast("error", err.response?.data?.error || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page centered">
      <form className="card" onSubmit={handleSubmit}>
        <img src={logo} alt="KP HCIP" className="login-logo" />
        <p className="login-tagline">Field Community Engagement</p>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <button type="submit" disabled={busy} className={busy ? "btn-loading" : ""}>
          <span className="btn-label">Sign in</span>
          {busy && <span className="btn-spinner" />}
        </button>
      </form>
    </div>
  );
}
