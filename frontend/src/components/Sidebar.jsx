import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const navItems = [
  {
    to: "/",
    label: "Dashboard",
    end: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 13a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1h-4a1 1 0 01-1-1v-6z"
        />
      </svg>
    ),
  },
  {
    to: "/chat",
    label: "AI Coach",
    end: false,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
        />
      </svg>
    ),
  },
  {
    to: "/transactions",
    label: "Transactions",
    end: false,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 6h16M4 12h10M4 18h16"
        />
      </svg>
    ),
  },
  {
    to: "/upload",
    label: "Upload CSV",
    end: false,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5-5m0 0l5 5m-5-5v12"
        />
      </svg>
    ),
  },
];

function firstLetter(name) {
  const c = (name || "").trim()[0];
  return c ? c.toUpperCase() : "U";
}

export default function Sidebar() {
  const { user, logout } = useAuth();
  const displayName = user?.name || "User";
  const isPro = user?.plan === "pro";

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo-row">
          <div className="sidebar-logo-mark" aria-hidden />
          <span className="sidebar-logo-text">FinCoach</span>
        </div>
        <span className="sidebar-beta">Beta</span>
      </div>

      <div className="sidebar-menu-label">Menu</div>
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              "sidebar-link" + (isActive ? " active" : "")
            }
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer-wrap">
        <div className="sidebar-user-card">
          <div className="sidebar-avatar" aria-hidden>
            {firstLetter(displayName)}
          </div>
          <div className="sidebar-user-meta">
            <div className="sidebar-user-name">{displayName}</div>
            <span
              className={
                "sidebar-plan-pill " +
                (isPro ? "sidebar-plan-pill--pro" : "sidebar-plan-pill--free")
              }
            >
              {isPro ? "Pro plan" : "Free plan"}
            </span>
          </div>
        </div>
        <button type="button" className="sidebar-signout" onClick={logout}>
          Sign out
        </button>
      </div>
    </aside>
  );
}
