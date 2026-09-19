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
import MyMonitoringVisits from "./pages/MyMonitoringVisits";
import TlReviewDashboard from "./pages/TlReviewDashboard";
import Dashboard from "./pages/Dashboard";
import AdminPanel from "./pages/AdminPanel";
import ExecutiveDashboard from "./pages/ExecutiveDashboard";
import "./index.css";

const LANDING_ROUTE_BY_ROLE = {
  member: "/submit",
  district_viewer: "/my-activities",
  grm_focal: "/my-grm-activities",
  tl_reviewer: "/tl-review",
  executive: "/executive",
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
              path="/my-monitoring-visits"
              element={
                <ProtectedRoute roles={["district_viewer"]}>
                  <MyMonitoringVisits />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tl-review"
              element={
                <ProtectedRoute roles={["tl_reviewer", "super_admin"]}>
                  <TlReviewDashboard />
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
            <Route
              path="/executive"
              element={
                <ProtectedRoute roles={["executive"]}>
                  <ExecutiveDashboard />
                </ProtectedRoute>
              }
            />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
