import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

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
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setApiError("Invalid email or password");
        return;
      }
      login(data.token, data.user);
      navigate("/", { replace: true });
    } catch {
      setApiError("Invalid email or password");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page-center">
      <div className="auth-card">
        <div className="auth-card-header">
          <div className="auth-card-mark" aria-hidden>
            F
          </div>
          <h1 className="auth-card-title">FinCoach</h1>
          <p className="auth-card-tagline">Your AI-powered finance coach</p>
        </div>

        {apiError ? <div className="auth-api-error">{apiError}</div> : null}

        <form onSubmit={onSubmit}>
          <div className="auth-field">
            <label className="auth-label" htmlFor="login-email">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              className={emailError ? "auth-input-error" : ""}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailError("");
              }}
            />
            {emailError ? (
              <div className="auth-field-error">{emailError}</div>
            ) : null}
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="login-password">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              className={passwordError ? "auth-input-error" : ""}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setPasswordError("");
              }}
            />
            {passwordError ? (
              <div className="auth-field-error">{passwordError}</div>
            ) : null}
          </div>

          <button
            type="submit"
            className="btn auth-submit"
            disabled={submitting}
          >
            {submitting ? (
              <span className="auth-submit-spinner-only" aria-label="Signing in" />
            ) : (
              "Sign in"
            )}
          </button>
        </form>

        <div className="auth-switch">
          Don&apos;t have an account?{" "}
          <Link to="/register">Sign up</Link>
        </div>
      </div>
    </div>
  );
}
