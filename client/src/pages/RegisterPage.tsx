import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ApiClientError } from "../api/client";

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await register(email, password);
      navigate("/tasks");
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card" data-testid="register-card">
        <span className="eyebrow">TaskFlow</span>
        <h1>Create an account</h1>
        <p className="subtitle">Takes about ten seconds.</p>

        <form onSubmit={handleSubmit} data-testid="register-form" noValidate>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            data-testid="register-email-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            data-testid="register-password-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
          <p className="field-hint">At least 8 characters.</p>

          {error && (
            <p className="form-error" role="alert" data-testid="register-error">
              {error}
            </p>
          )}

          <button type="submit" data-testid="register-submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account? <Link to="/login" data-testid="go-to-login">Log in</Link>
        </p>
      </div>
    </div>
  );
}
