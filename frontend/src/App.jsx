import { useCallback, useEffect, useState } from "react";
import {
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import Sidebar from "./components/Sidebar.jsx";
import Topbar from "./components/Topbar.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Chat from "./pages/Chat.jsx";
import Transactions from "./pages/Transactions.jsx";
import Upload from "./pages/Upload.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";

const TITLES = {
  "/": "Dashboard",
  "/chat": "AI Coach",
  "/transactions": "Transactions",
  "/upload": "Upload CSV",
};

function ProtectedRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="auth-fullpage-loading">
        <div className="auth-fullpage-spinner" aria-label="Loading" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

function Layout() {
  const location = useLocation();
  const title = TITLES[location.pathname] || "FinCoach";
  const [fileLabel, setFileLabel] = useState("No file loaded");
  const { token, logout } = useAuth();

  const refreshFileLabel = useCallback(async () => {
    if (!token) {
      setFileLabel("No file loaded");
      return;
    }
    try {
      const res = await fetch("/api/summary", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        logout();
        return;
      }
      if (!res.ok) {
        setFileLabel("No file loaded");
        return;
      }
      const data = await res.json();
      if (data.filename) {
        setFileLabel(data.filename);
      } else {
        setFileLabel("No file loaded");
      }
    } catch {
      setFileLabel("No file loaded");
    }
  }, [token, logout]);

  useEffect(() => {
    refreshFileLabel();
  }, [location.pathname, refreshFileLabel]);

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
        <Topbar title={title} fileLabel={fileLabel} />
        <div className="app-content">
          <Outlet context={{ refreshFileLabel }} />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/upload" element={<Upload />} />
        </Route>
      </Route>
    </Routes>
  );
}
