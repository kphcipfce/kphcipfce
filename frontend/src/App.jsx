import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import ProtectedRoute from "./components/ProtectedRoute";
import NavBar from "./components/NavBar";
import Login from "./pages/Login";
import SubmitActivity from "./pages/SubmitActivity";
import MyTeam from "./pages/MyTeam";
import MyActivities from "./pages/MyActivities";
import MyGrmActivities from "./pages/MyGrmActivities";
import Dashboard from "./pages/Dashboard";
import AdminPanel from "./pages/AdminPanel";
import "./index.css";

// Every role lands on its own activities/submission page first, not the Dashboard — matches
// the social mobilizer's existing "/submit" landing behavior.
const LANDING_ROUTE_BY_ROLE = {
  member: "/submit",
  district_viewer: "/my-activities",
  grm_focal: "/my-grm-activities",
};

function Home() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={LANDING_ROUTE_BY_ROLE[user.role] || "/dashboard"} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <NavBar />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route
              path="/submit"
              element={
                <ProtectedRoute roles={["member"]}>
                  <SubmitActivity />
                </ProtectedRoute>
              }
            />
            <Route
              path="/my-team"
              element={
                <ProtectedRoute roles={["member"]}>
                  <MyTeam />
                </ProtectedRoute>
              }
            />
            <Route
              path="/my-activities"
              element={
                <ProtectedRoute roles={["district_viewer"]}>
                  <MyActivities />
                </ProtectedRoute>
              }
            />
            <Route
              path="/my-grm-activities"
              element={
                <ProtectedRoute roles={["grm_focal"]}>
                  <MyGrmActivities />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute roles={["super_admin"]}>
                  <AdminPanel />
                </ProtectedRoute>
              }
            />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
