import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const API_URL = import.meta.env.VITE_API_URL;

export default function Login() {
  const navigate = useNavigate();
  const { login, user, isLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [apiError, setApiError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (user) navigate("/", { replace: true });
  }, [isLoading, user, navigate]);

  const validate = () => {
    let ok = true;

    if (!email.includes("@")) {
      setEmailError("Enter a valid email address.");
      ok = false;
    } else {
      setEmailError("");
    }

    if (password.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
      ok = false;
    } else {
      setPasswordError("");
    }

    return ok;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setApiError("");

    if (!validate()) return;

    setSubmitting(true);

    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setApiError(data.error || "Invalid email or password");
        return;
      }

      login(data.token, data.user);
      navigate("/", { replace: true });
    } catch (err) {
      setApiError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page-center">
      <div className="auth-card">
        <div className="auth-card-header">
          <div className="auth-card-mark">F</div>
          <h1 className="auth-card-title">FinCoach</h1>
          <p className="auth-card-tagline">Your AI-powered finance coach</p>
        </div>

        {apiError && <div className="auth-api-error">{apiError}</div>}

        <form onSubmit={onSubmit}>
          <div className="auth-field">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailError("");
              }}
            />
            {emailError && (
              <div className="auth-field-error">{emailError}</div>
            )}
          </div>

          <div className="auth-field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setPasswordError("");
              }}
            />
            {passwordError && (
              <div className="auth-field-error">{passwordError}</div>
            )}
          </div>

          <button type="submit" disabled={submitting}>
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div className="auth-switch">
          Don&apos;t have an account? <Link to="/register">Sign up</Link>
        </div>
      </div>
    </div>
  );
}