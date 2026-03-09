import { FormEvent, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth-context";
import { ApiError } from "../lib/api";

export function LoginPage() {
  const { status, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (status === "authenticated") {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      await login(email, password);
      const redirectTo = (location.state as { from?: string } | null)?.from ?? "/dashboard";
      navigate(redirectTo, { replace: true });
    } catch (nextError) {
      setError(nextError instanceof ApiError ? nextError.message : "Falha ao entrar.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-layout">
      <section className="auth-card">
        <p className="eyebrow">Gestor JMU</p>
        <h1>Acesso interno</h1>
        <p className="muted">Entre com seu usuario para operar o fluxo pre-SEI/SEI.</p>

        <form className="form-stack" onSubmit={handleSubmit}>
          <label>
            Email
            <input autoComplete="email" onChange={(event) => setEmail(event.target.value)} type="email" value={email} />
          </label>

          <label>
            Senha
            <input
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
          </label>

          {error ? <p className="error-text">{error}</p> : null}

          <button className="button primary" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </section>
    </div>
  );
}
