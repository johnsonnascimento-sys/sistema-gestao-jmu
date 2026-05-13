import { FormEvent, useEffect, useState } from "react";
import { FileSpreadsheet, Plus, Square, SquareCheckBig } from "lucide-react";
import { PageHeader } from "../components/page-header";
import { ErrorState, LoadingState } from "../components/states";
import { FormField } from "../components/form-field";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { createPessoa, downloadPessoasExcel, formatAppError, listPessoas, updatePessoa } from "../lib/api";
import { formatCpf, isValidCpf } from "../lib/cpf";
import type { Interessado } from "../types";

type InteressadoFormState = {
  nome: string;
  cargo: string;
  matricula: string;
  cpf: string;
  rg: string;
  pai: string;
  mae: string;
  endereco: string;
  data_nascimento: string;
};

const EMPTY_FORM: InteressadoFormState = {
  nome: "",
  cargo: "",
  matricula: "",
  cpf: "",
  rg: "",
  pai: "",
  mae: "",
  endereco: "",
  data_nascimento: "",
};

function normalizePayload(form: InteressadoFormState) {
  return {
    nome: form.nome,
    cargo: form.cargo || null,
    matricula: form.matricula || null,
    cpf: form.cpf || null,
    rg: form.rg || null,
    pai: form.pai || null,
    mae: form.mae || null,
    endereco: form.endereco || null,
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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);

  async function load(query = search) {
    setLoading(true);

    try {
      const result = await listPessoas({ q: query, page: 1, pageSize: 50 });
      setItems(result.items);
      setSelectedIds([]);
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

  const selectedCount = selectedIds.length;
  const allVisibleSelected = items.length > 0 && items.every((item) => selectedIds.includes(item.id));

  function toggleSelection(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((itemId) => itemId !== id) : [...current, id]));
  }

  function toggleVisibleSelection() {
    if (allVisibleSelected) {
      setSelectedIds((current) => current.filter((id) => !items.some((item) => item.id === id)));
      return;
    }

    setSelectedIds((current) => Array.from(new Set([...current, ...items.map((item) => item.id)])));
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  async function exportSelected() {
    if (selectedIds.length === 0) {
      return;
    }

    setExporting(true);
    setError("");

    try {
      await downloadPessoasExcel(selectedIds);
    } catch (nextError) {
      setError(formatAppError(nextError, "Falha ao exportar pessoas."));
    } finally {
      setExporting(false);
    }
  }

  function openEditDialog(item: Interessado) {
    setEditing(item);
    setForm({
      nome: item.nome,
      cargo: item.cargo ?? "",
      matricula: item.matricula ?? "",
      cpf: item.cpf ? formatCpf(item.cpf) : "",
      rg: item.rg ?? "",
      pai: item.pai ?? "",
      mae: item.mae ?? "",
      endereco: item.endereco ?? "",
      data_nascimento: item.dataNascimento ?? "",
    });
    setDialogOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError("");

    try {
      const cpfValue = form.cpf.trim();
      if (cpfValue.length > 0 && !isValidCpf(cpfValue)) {
        setError("CPF invalido.");
        return;
      }

      if (editing) {
        await updatePessoa(editing.id, normalizePayload(form));
      } else {
        await createPessoa(normalizePayload(form));
      }

      setDialogOpen(false);
      setForm(EMPTY_FORM);
      setEditing(null);
      setSelectedIds([]);
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
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={exportSelected} disabled={exporting || selectedIds.length === 0} type="button" variant="secondary">
              <FileSpreadsheet className="h-4 w-4" />
              {exporting ? "Exportando..." : "Exportar Excel"}
            </Button>
            <Button onClick={openCreateDialog} type="button">
              <Plus className="h-4 w-4" />
              Adicionar pessoa
            </Button>
          </div>
        }
      />

      {error ? <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div> : null}

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <CardTitle>Base reutilizavel</CardTitle>
            <CardDescription>Use nome, cargo, matricula ou CPF para localizar rapidamente o cadastro correto.</CardDescription>
          </div>
          <form
            className="flex w-full gap-3 md:max-w-xl"
            onSubmit={(event) => {
              event.preventDefault();
              void load(search);
            }}
          >
            <Input onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome, cargo, matricula ou CPF" value={search} />
              <Button type="submit" variant="secondary">
                Buscar
              </Button>
            </form>
          </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-col gap-3 rounded-3xl border border-slate-200 bg-slate-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm font-medium text-slate-700">
              {selectedCount > 0 ? `${selectedCount} pessoa(s) selecionada(s) para exportacao.` : "Selecione pessoas na tabela para exportar em Excel."}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button disabled={items.length === 0} onClick={toggleVisibleSelection} type="button" variant="ghost">
                {allVisibleSelected ? <SquareCheckBig className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                {allVisibleSelected ? "Desmarcar exibidas" : "Selecionar exibidas"}
              </Button>
              <Button disabled={selectedIds.length === 0} onClick={clearSelection} type="button" variant="ghost">
                Limpar selecao
              </Button>
            </div>
          </div>
          <div className="overflow-hidden rounded-[28px] border border-white/70 shadow-[0_12px_24px_rgba(20,33,61,0.05)]">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(240,246,249,0.92))] text-left text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                <tr>
                  <th className="w-12 px-4 py-3">
                    <input
                      aria-label="Selecionar todas as pessoas exibidas"
                      checked={allVisibleSelected}
                      className="h-4 w-4 accent-slate-950"
                      disabled={items.length === 0}
                      onChange={toggleVisibleSelection}
                      type="checkbox"
                    />
                  </th>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Cargo</th>
                  <th className="px-4 py-3">Matricula</th>
                  <th className="px-4 py-3">CPF</th>
                  <th className="px-4 py-3">RG</th>
                  <th className="px-4 py-3">Nascimento</th>
                  <th className="px-4 py-3">Criado em</th>
                  <th className="px-4 py-3 text-right">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white/95">
                {items.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-sm text-slate-500" colSpan={9}>
                      Nenhuma pessoa encontrada.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr className="align-top" key={item.id}>
                      <td className="px-4 py-4">
                        <input
                          aria-label={`Selecionar pessoa ${item.nome}`}
                          checked={selectedIds.includes(item.id)}
                          className="mt-1 h-4 w-4 accent-slate-950"
                          onChange={() => toggleSelection(item.id)}
                          type="checkbox"
                        />
                      </td>
                      <td className="px-4 py-4 font-medium text-slate-950">{item.nome}</td>
                      <td className="px-4 py-4 text-slate-600">{item.cargo ?? "-"}</td>
                      <td className="px-4 py-4 text-slate-600">{item.matricula ?? "-"}</td>
                      <td className="px-4 py-4 text-slate-600">{item.cpf ? formatCpf(item.cpf) : "-"}</td>
                      <td className="px-4 py-4 text-slate-600">{item.rg ?? "-"}</td>
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
            <FormField label="Cargo">
              <Input onChange={(event) => setForm((current) => ({ ...current, cargo: event.target.value }))} value={form.cargo} />
            </FormField>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Pai">
                <Input onChange={(event) => setForm((current) => ({ ...current, pai: event.target.value }))} value={form.pai} />
              </FormField>
              <FormField label="Mae">
                <Input onChange={(event) => setForm((current) => ({ ...current, mae: event.target.value }))} value={form.mae} />
              </FormField>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Matricula">
                <Input onChange={(event) => setForm((current) => ({ ...current, matricula: event.target.value }))} value={form.matricula} />
              </FormField>
              <FormField label="CPF">
                <Input onChange={(event) => setForm((current) => ({ ...current, cpf: formatCpf(event.target.value) }))} value={form.cpf} />
              </FormField>
            </div>
            <FormField label="RG">
              <Input onChange={(event) => setForm((current) => ({ ...current, rg: event.target.value }))} value={form.rg} />
            </FormField>
            <FormField label="Endereco">
              <Input onChange={(event) => setForm((current) => ({ ...current, endereco: event.target.value }))} value={form.endereco} />
            </FormField>
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
