import { FormEvent, useEffect, useState } from "react";
import { PageHeader } from "../components/page-header";
import { ErrorState, LoadingState } from "../components/states";
import { FormField } from "../components/form-field";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { createPessoa, formatAppError, listPessoas, updatePessoa } from "../lib/api";
import type { Interessado } from "../types";

type InteressadoFormState = {
  nome: string;
  matricula: string;
  cpf: string;
  data_nascimento: string;
};

const EMPTY_FORM: InteressadoFormState = {
  nome: "",
  matricula: "",
  cpf: "",
  data_nascimento: "",
};

function normalizePayload(form: InteressadoFormState) {
  return {
    nome: form.nome,
    matricula: form.matricula || null,
    cpf: form.cpf || null,
    data_nascimento: form.data_nascimento || null,
  };
}

export function InteressadosPage() {
  const [items, setItems] = useState<Interessado[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Interessado | null>(null);
  const [form, setForm] = useState<InteressadoFormState>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  async function load(query = search) {
    setLoading(true);

    try {
      const result = await listPessoas({ q: query, page: 1, pageSize: 50 });
      setItems(result.items);
      setError("");
    } catch (nextError) {
      setError(formatAppError(nextError, "Falha ao carregar pessoas."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load("");
  }, []);

  function openCreateDialog() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEditDialog(item: Interessado) {
    setEditing(item);
    setForm({
      nome: item.nome,
      matricula: item.matricula ?? "",
      cpf: item.cpf ?? "",
      data_nascimento: item.dataNascimento ?? "",
    });
    setDialogOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError("");

    try {
      if (editing) {
        await updatePessoa(editing.id, normalizePayload(form));
      } else {
        await createPessoa(normalizePayload(form));
      }

      setDialogOpen(false);
      setForm(EMPTY_FORM);
      setEditing(null);
      await load();
    } catch (nextError) {
      setError(formatAppError(nextError, "Falha ao guardar pessoa."));
    } finally {
      setIsSaving(false);
    }
  }

  if (loading) {
    return <LoadingState title="Carregando pessoas" description="Preparando o cadastro base para vinculos processuais." />;
  }

  if (error && items.length === 0) {
    return <ErrorState description={error} />;
  }

  return (
    <section className="grid gap-6">
      <PageHeader
        eyebrow="Cadastro base"
        title="Pessoas"
        description="Mantenha as pessoas reutilizaveis para vincular rapidamente aos processos."
        actions={
          <Button onClick={openCreateDialog} type="button">
            Adicionar pessoa
          </Button>
        }
      />

      {error ? <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div> : null}

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <CardTitle>Base reutilizavel</CardTitle>
            <CardDescription>Use nome, matricula ou CPF para localizar rapidamente o cadastro correto.</CardDescription>
          </div>
          <form
            className="flex w-full gap-3 md:max-w-xl"
            onSubmit={(event) => {
              event.preventDefault();
              void load(search);
            }}
          >
            <Input onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome, matricula ou CPF" value={search} />
            <Button type="submit" variant="secondary">
              Buscar
            </Button>
          </form>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-[28px] border border-white/70 shadow-[0_12px_24px_rgba(20,33,61,0.05)]">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(240,246,249,0.92))] text-left text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Matricula</th>
                  <th className="px-4 py-3">CPF</th>
                  <th className="px-4 py-3">Nascimento</th>
                  <th className="px-4 py-3">Criado em</th>
                  <th className="px-4 py-3 text-right">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white/95">
                {items.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-sm text-slate-500" colSpan={6}>
                      Nenhuma pessoa encontrada.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr className="align-top" key={item.id}>
                      <td className="px-4 py-4 font-medium text-slate-950">{item.nome}</td>
                      <td className="px-4 py-4 text-slate-600">{item.matricula ?? "-"}</td>
                      <td className="px-4 py-4 text-slate-600">{item.cpf ?? "-"}</td>
                      <td className="px-4 py-4 text-slate-600">{item.dataNascimento ? new Date(item.dataNascimento).toLocaleDateString("pt-BR") : "-"}</td>
                      <td className="px-4 py-4 text-slate-600">{new Date(item.createdAt).toLocaleDateString("pt-BR")}</td>
                      <td className="px-4 py-4 text-right">
                        <Button onClick={() => openEditDialog(item)} size="sm" type="button" variant="ghost">
                          Editar
                        </Button>
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
            <DialogTitle>{editing ? "Editar pessoa" : "Nova pessoa"}</DialogTitle>
            <DialogDescription>Este cadastro sera reutilizado no painel de envolvidos e nos atalhos processuais.</DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={handleSubmit}>
            <FormField label="Nome">
              <Input onChange={(event) => setForm((current) => ({ ...current, nome: event.target.value }))} value={form.nome} />
            </FormField>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Matricula">
                <Input onChange={(event) => setForm((current) => ({ ...current, matricula: event.target.value }))} value={form.matricula} />
              </FormField>
              <FormField label="CPF">
                <Input onChange={(event) => setForm((current) => ({ ...current, cpf: event.target.value }))} value={form.cpf} />
              </FormField>
            </div>
            <FormField label="Data de nascimento">
              <Input onChange={(event) => setForm((current) => ({ ...current, data_nascimento: event.target.value }))} type="date" value={form.data_nascimento} />
            </FormField>
            <DialogFooter>
              <Button onClick={() => setDialogOpen(false)} type="button" variant="ghost">
                Cancelar
              </Button>
              <Button disabled={isSaving || form.nome.trim().length < 3} type="submit">
                {isSaving ? "Salvando..." : editing ? "Salvar alteracoes" : "Criar pessoa"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
