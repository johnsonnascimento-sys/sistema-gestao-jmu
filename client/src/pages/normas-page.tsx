import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth-context";
import { FormField } from "../components/form-field";
import { PageHeader } from "../components/page-header";
import { ErrorState, LoadingState } from "../components/states";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { createNorma, formatAppError, listNormas, updateNorma } from "../lib/api";
import type { Norma } from "../types";

type NormaFormState = {
  numero: string;
  data_norma: string;
  origem: string;
};

const EMPTY_FORM: NormaFormState = {
  numero: "",
  data_norma: "",
  origem: "",
};

export function NormasPage() {
  const { hasPermission } = useAuth();
  const [items, setItems] = useState<Norma[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Norma | null>(null);
  const [form, setForm] = useState<NormaFormState>(EMPTY_FORM);
  const [search, setSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const canWrite = hasPermission("cadastro.norma.write");

  async function load() {
    setLoading(true);
    try {
      const result = await listNormas();
      setItems(result);
      setError("");
    } catch (nextError) {
      setError(formatAppError(nextError, "Falha ao carregar normas."));
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
    return items.filter((item) => [item.numero, item.origem].some((value) => value.toLowerCase().includes(query)));
  }, [items, search]);

  function openCreateDialog() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEditDialog(item: Norma) {
    setEditing(item);
    setForm({
      numero: item.numero,
      data_norma: item.dataNorma,
      origem: item.origem,
    });
    setDialogOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError("");

    try {
      const payload = {
        numero: form.numero.trim(),
        data_norma: form.data_norma,
        origem: form.origem.trim(),
      };

      if (editing) {
        await updateNorma(editing.id, payload);
      } else {
        await createNorma(payload);
      }

      setDialogOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      await load();
    } catch (nextError) {
      setError(formatAppError(nextError, "Falha ao guardar norma."));
    } finally {
      setIsSaving(false);
    }
  }

  if (loading) {
    return <LoadingState description="Preparando o repositorio institucional de normas." title="Carregando normas" />;
  }

  if (error && items.length === 0) {
    return <ErrorState description={error} />;
  }

  return (
    <section className="grid gap-6">
      <PageHeader
        eyebrow="Cadastro base"
        title="Normas"
        description="Repositorio interno de normas com numero, data e origem para consulta e reutilizacao."
        actions={
          canWrite ? (
            <Button onClick={openCreateDialog} type="button">
              Adicionar norma
            </Button>
          ) : undefined
        }
      />

      {error ? <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div> : null}

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <CardTitle>Repositorio de normas</CardTitle>
            <CardDescription>Base estruturada para consulta rapida por numero ou origem da norma.</CardDescription>
          </div>
          <Input className="md:max-w-sm" onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por numero ou origem" value={search} />
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-[28px] border border-white/70 shadow-[0_12px_24px_rgba(20,33,61,0.05)]">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(240,246,249,0.92))] text-left text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Numero</th>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Origem</th>
                  <th className="px-4 py-3 text-right">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white/95">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-sm text-slate-500" colSpan={4}>
                      Nenhuma norma encontrada.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-4 font-semibold text-slate-950">{item.numero}</td>
                      <td className="px-4 py-4 text-slate-600">{new Date(item.dataNorma).toLocaleDateString("pt-BR")}</td>
                      <td className="px-4 py-4 text-slate-600">{item.origem}</td>
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
            <DialogTitle>{editing ? "Editar norma" : "Nova norma"}</DialogTitle>
            <DialogDescription>Registe a norma com numero, data e origem institucional.</DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={handleSubmit}>
            <FormField label="Numero">
              <Input onChange={(event) => setForm((current) => ({ ...current, numero: event.target.value }))} value={form.numero} />
            </FormField>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Data">
                <Input onChange={(event) => setForm((current) => ({ ...current, data_norma: event.target.value }))} type="date" value={form.data_norma} />
              </FormField>
              <FormField label="Origem">
                <Input onChange={(event) => setForm((current) => ({ ...current, origem: event.target.value }))} value={form.origem} />
              </FormField>
            </div>
            <DialogFooter>
              <Button onClick={() => setDialogOpen(false)} type="button" variant="ghost">
                Cancelar
              </Button>
              <Button disabled={isSaving || form.numero.trim().length < 1 || !form.data_norma || form.origem.trim().length < 2} type="submit">
                {isSaving ? "Salvando..." : editing ? "Salvar alteracoes" : "Criar norma"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
