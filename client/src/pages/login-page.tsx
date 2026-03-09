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
    <div className="grid min-h-screen place-items-center px-4 py-8">
      <div className="grid w-full max-w-6xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[36px] border border-slate-200/70 bg-[linear-gradient(135deg,rgba(13,27,42,0.94),rgba(20,33,61,0.94)),linear-gradient(135deg,rgba(244,162,97,0.22),transparent_50%)] p-8 text-white shadow-[0_28px_80px_rgba(20,33,61,0.2)]">
          <p className="text-xs font-bold uppercase tracking-[0.32em] text-amber-200">Gestor JMU</p>
          <h1 className='mt-4 max-w-xl font-["IBM_Plex_Serif",Georgia,serif] text-4xl leading-tight sm:text-5xl'>Operacao pre-SEI e SEI sem dependencia externa.</h1>
          <p className="mt-4 max-w-xl text-base text-slate-300">
            Acompanhe demandas, associe processos, audite mudancas e administre o fluxo num unico painel interno.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              "Kanban operacional por status",
              "Timeline unificada com auditoria",
              "Gestao de utilizadores e permissoes",
            ].map((item) => (
              <div className="rounded-[24px] border border-white/10 bg-white/8 px-4 py-5 text-sm text-slate-200" key={item}>
                {item}
              </div>
            ))}
          </div>
        </section>

        <Card className="self-center">
          <CardHeader>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-rose-600">Acesso interno</p>
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
