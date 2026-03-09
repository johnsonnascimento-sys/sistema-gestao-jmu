import { useEffect, useState } from "react";
import { FormField } from "../components/form-field";
import { PageHeader } from "../components/page-header";
import { ErrorState, LoadingState } from "../components/states";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { createAdminUser, listAdminUserAudit, listAdminUsers, resetAdminUserPassword, updateAdminUser } from "../lib/api";
import type { AdminUserAuditRecord, AdminUserSummary, UserRole } from "../types";

const selectClassName =
  "h-11 w-full rounded-2xl border border-slate-200 bg-white/90 px-4 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-amber-200/50";

export function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [audit, setAudit] = useState<AdminUserAuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [createForm, setCreateForm] = useState({
    email: "",
    name: "",
    password: "",
    role: "operador" as UserRole,
  });
  const [resetTarget, setResetTarget] = useState<AdminUserSummary | null>(null);
  const [newPassword, setNewPassword] = useState("");

  async function load() {
    setLoading(true);

    try {
      const [nextUsers, nextAudit] = await Promise.all([listAdminUsers(), listAdminUserAudit(12)]);
      setUsers(nextUsers);
      setAudit(nextAudit);
      setError("");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Falha ao carregar utilizadores.");
    } finally {
      setLoading(false);
    }
  }

  function describeAudit(item: AdminUserAuditRecord) {
    switch (item.action) {
      case "user_created":
        return "Criou o utilizador.";
      case "user_name_changed":
        return `Alterou o nome de ${item.nameAnterior ?? "-"} para ${item.nameNovo ?? "-"}.`;
      case "user_role_changed":
        return `Alterou o papel de ${item.roleAnterior ?? "-"} para ${item.roleNovo ?? "-"}.`;
      case "user_activated":
        return "Reativou o utilizador.";
      case "user_deactivated":
        return "Desativou o utilizador.";
      case "user_password_reset":
        return "Redefiniu a palavra-passe.";
      default:
        return "Executou uma alteracao administrativa.";
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (loading) {
    return <LoadingState description="A carregar a administracao de acessos do Gestor Web." title="Carregando utilizadores" />;
  }

  if (error && users.length === 0) {
    return <ErrorState description={error} />;
  }

  return (
    <section className="grid gap-6">
      <PageHeader
        description="Administracao simples de acessos, papeis e activacao de utilizadores internos."
        eyebrow="Administracao"
        title="Utilizadores"
      />

      {error && users.length > 0 ? <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div> : null}
      {message ? <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{message}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>Novo utilizador</CardTitle>
            <CardDescription>Crie contas operacionais e defina o papel inicial.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <FormField label="Nome">
              <Input onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))} value={createForm.name} />
            </FormField>
            <FormField label="Email">
              <Input onChange={(event) => setCreateForm((current) => ({ ...current, email: event.target.value }))} type="email" value={createForm.email} />
            </FormField>
            <FormField label="Senha inicial">
              <Input onChange={(event) => setCreateForm((current) => ({ ...current, password: event.target.value }))} type="password" value={createForm.password} />
            </FormField>
            <FormField label="Papel">
              <select className={selectClassName} onChange={(event) => setCreateForm((current) => ({ ...current, role: event.target.value as UserRole }))} value={createForm.role}>
                <option value="operador">Operador</option>
                <option value="admin">Admin</option>
              </select>
            </FormField>

            <Button
              onClick={async () => {
                try {
                  setError("");
                  setMessage("");
                  await createAdminUser(createForm);
                  setCreateForm({
                    email: "",
                    name: "",
                    password: "",
                    role: "operador",
                  });
                  setMessage("Utilizador criado com sucesso.");
                  await load();
                } catch (nextError) {
                  setError(nextError instanceof Error ? nextError.message : "Falha ao criar utilizador.");
                }
              }}
              type="button"
            >
              Criar utilizador
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contas existentes</CardTitle>
            <CardDescription>Atualize papel, estado e palavra-passe quando necessario.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {users.map((user) => (
              <article className="grid gap-4 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4" key={user.id}>
                <div>
                  <h3 className="text-base font-semibold text-slate-950">{user.name}</h3>
                  <p className="text-sm text-slate-500">{user.email}</p>
                </div>
                <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
                  <select
                    className={selectClassName}
                    value={user.role}
                    onChange={async (event) => {
                      try {
                        setError("");
                        await updateAdminUser(user.id, { role: event.target.value as UserRole });
                        setMessage(`Papel de ${user.name} atualizado.`);
                        await load();
                      } catch (nextError) {
                        setError(nextError instanceof Error ? nextError.message : "Falha ao atualizar papel.");
                      }
                    }}
                  >
                    <option value="operador">Operador</option>
                    <option value="admin">Admin</option>
                  </select>
                  <Button
                    onClick={async () => {
                      try {
                        setError("");
                        await updateAdminUser(user.id, { active: !user.active });
                        setMessage(`${user.name} ${user.active ? "desativado" : "ativado"} com sucesso.`);
                        await load();
                      } catch (nextError) {
                        setError(nextError instanceof Error ? nextError.message : "Falha ao atualizar utilizador.");
                      }
                    }}
                    type="button"
                    variant="secondary"
                  >
                    {user.active ? "Desativar" : "Ativar"}
                  </Button>
                  <Button onClick={() => setResetTarget(user)} type="button" variant="ghost">
                    Reset de senha
                  </Button>
                </div>
              </article>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Auditoria administrativa</CardTitle>
          <CardDescription>Ultimas alteracoes de acesso, papel e credenciais.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {audit.map((item) => (
            <article className="grid gap-2 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4" key={item.id}>
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-950">{item.targetUser.name}</h3>
                  <p className="text-sm text-slate-500">{item.targetUser.email}</p>
                </div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">{new Date(item.registradoEm).toLocaleString("pt-BR")}</p>
              </div>
              <p className="text-sm text-slate-700">{describeAudit(item)}</p>
              <p className="text-xs text-slate-500">{item.actor ? `${item.actor.name} (${item.actor.email})` : "Bootstrap do sistema"}</p>
            </article>
          ))}
          {audit.length === 0 ? <p className="text-sm text-slate-500">Nenhuma alteracao administrativa registada ainda.</p> : null}
        </CardContent>
      </Card>

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setResetTarget(null);
            setNewPassword("");
          }
        }}
        open={Boolean(resetTarget)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redefinir palavra-passe</DialogTitle>
            <DialogDescription>{resetTarget ? `Nova senha para ${resetTarget.name}.` : ""}</DialogDescription>
          </DialogHeader>

          <FormField label="Nova senha">
            <Input onChange={(event) => setNewPassword(event.target.value)} type="password" value={newPassword} />
          </FormField>

          <DialogFooter>
            <Button onClick={() => setResetTarget(null)} type="button" variant="ghost">
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                if (!resetTarget) {
                  return;
                }

                try {
                  setError("");
                  await resetAdminUserPassword(resetTarget.id, newPassword);
                  setMessage(`Senha de ${resetTarget.name} atualizada.`);
                  setNewPassword("");
                  setResetTarget(null);
                } catch (nextError) {
                  setError(nextError instanceof Error ? nextError.message : "Falha ao redefinir senha.");
                }
              }}
              type="button"
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
