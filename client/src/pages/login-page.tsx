import { FormEvent, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth-context";
import { FormField } from "../components/form-field";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { formatAppError } from "../lib/api";

export function LoginPage() {
  const { status, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (status === "authenticated") {
    return <Navigate replace to="/dashboard" />;
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
      setError(formatAppError(nextError, "Falha ao entrar."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.92),rgba(241,245,249,0.98))] px-4 py-8">
      <div className="grid w-full max-w-md">
        <Card className="self-center">
          <CardHeader>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-indigo-600">Acesso interno</p>
            <CardTitle>Entrar no Gestor Web</CardTitle>
            <CardDescription>Use as credenciais do modulo administrativo para continuar.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={handleSubmit}>
              <FormField label="Email">
                <Input autoComplete="email" onChange={(event) => setEmail(event.target.value)} type="email" value={email} />
              </FormField>

              <FormField label="Senha">
                <Input autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} type="password" value={password} />
              </FormField>

              {error ? <p className="text-sm font-medium text-rose-700">{error}</p> : null}

              <Button disabled={isSubmitting} type="submit">
                {isSubmitting ? "Entrando..." : "Entrar"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
