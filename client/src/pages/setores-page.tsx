import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth-context";
import { FormField } from "../components/form-field";
import { PageHeader } from "../components/page-header";
import { ErrorState, LoadingState } from "../components/states";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { createSetor, formatAppError, listSetores, updateSetor } from "../lib/api";
import type { Setor } from "../types";

type SetorFormState = {
  sigla: string;
  nome_completo: string;
};

const EMPTY_FORM: SetorFormState = {
  sigla: "",
  nome_completo: "",
};

export function SetoresPage() {
  const { hasPermission } = useAuth();
  const [items, setItems] = useState<Setor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Setor | null>(null);
  const [form, setForm] = useState<SetorFormState>(EMPTY_FORM);
  const [search, setSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const canWrite = hasPermission("cadastro.setor.write");

  async function load() {
    setLoading(true);

    try {
      const result = await listSetores();
      setItems(result);
      setError("");
    } catch (nextError) {
      setError(formatAppError(nextError, "Falha ao carregar setores."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return items;
    }

    return items.filter((item) => item.sigla.toLowerCase().includes(query) || item.nomeCompleto.toLowerCase().includes(query));
  }, [items, search]);

  function openCreateDialog() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEditDialog(item: Setor) {
    setEditing(item);
    setForm({
      sigla: item.sigla,
      nome_completo: item.nomeCompleto,
    });
    setDialogOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError("");

    try {
      const payload = {
        sigla: form.sigla.trim().toUpperCase(),
        nome_completo: form.nome_completo.trim(),
      };

      if (editing) {
        await updateSetor(editing.id, payload);
      } else {
        await createSetor(payload);
      }

      setDialogOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      await load();
    } catch (nextError) {
      setError(formatAppError(nextError, "Falha ao guardar setor."));
    } finally {
      setIsSaving(false);
    }
  }

  if (loading) {
    return <LoadingState description="Preparando a base de destinatarios processuais." title="Carregando setores" />;
  }

  if (error && items.length === 0) {
    return <ErrorState description={error} />;
  }

  return (
    <section className="grid gap-6">
      <PageHeader
        eyebrow="Cadastro base"
        title="Setores"
        description="Destinatarios padronizados para tramitacao, encaminhamento e historico operacional."
        actions={
          canWrite ? (
            <Button onClick={openCreateDialog} type="button">
              Adicionar setor
            </Button>
          ) : undefined
        }
      />

      {error ? <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div> : null}

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <CardTitle>Destinatarios padronizados</CardTitle>
            <CardDescription>Mantenha as siglas oficiais e os nomes completos usados na tramitacao do processo.</CardDescription>
          </div>
          <Input className="md:max-w-sm" onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por sigla ou nome" value={search} />
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-[24px] border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Sigla</th>
                  <th className="px-4 py-3">Nome completo</th>
                  <th className="px-4 py-3">Atualizado em</th>
                  <th className="px-4 py-3 text-right">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-sm text-slate-500" colSpan={4}>
                      Nenhum setor encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-4 font-semibold text-slate-950">{item.sigla}</td>
                      <td className="px-4 py-4 text-slate-600">{item.nomeCompleto}</td>
                      <td className="px-4 py-4 text-slate-600">{new Date(item.updatedAt).toLocaleDateString("pt-BR")}</td>
                      <td className="px-4 py-4 text-right">
                        {canWrite ? (
                          <Button onClick={() => openEditDialog(item)} size="sm" type="button" variant="ghost">
                            Editar
                          </Button>
                        ) : (
                          <span className="text-xs text-slate-400">Leitura</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog onOpenChange={setDialogOpen} open={dialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar setor" : "Novo setor"}</DialogTitle>
            <DialogDescription>Este cadastro alimenta a tramitação e o histórico de andamentos automáticos.</DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-[160px_1fr]">
              <FormField label="Sigla">
                <Input onChange={(event) => setForm((current) => ({ ...current, sigla: event.target.value.toUpperCase() }))} value={form.sigla} />
              </FormField>
              <FormField label="Nome completo">
                <Input onChange={(event) => setForm((current) => ({ ...current, nome_completo: event.target.value }))} value={form.nome_completo} />
              </FormField>
            </div>
            <DialogFooter>
              <Button onClick={() => setDialogOpen(false)} type="button" variant="ghost">
                Cancelar
              </Button>
              <Button disabled={isSaving || form.sigla.trim().length < 2 || form.nome_completo.trim().length < 3} type="submit">
                {isSaving ? "Salvando..." : editing ? "Salvar alteracoes" : "Criar setor"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
