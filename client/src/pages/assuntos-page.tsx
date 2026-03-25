import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth-context";
import { FormField } from "../components/form-field";
import { PageHeader } from "../components/page-header";
import { EmptyState, ErrorState, LoadingState } from "../components/states";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { createAssunto, formatAppError, listAssuntos, listNormas, listSetores, updateAssunto } from "../lib/api";
import type { Assunto, Norma, Setor } from "../types";

type ProcedimentoForm = {
  ordem: string;
  descricao: string;
  horario_inicio: string;
  horario_fim: string;
  setor_destino_id: string;
};

type AssuntoForm = {
  nome: string;
  descricao: string;
  norma_ids: string[];
  procedimentos: ProcedimentoForm[];
};

const EMPTY_FORM: AssuntoForm = {
  nome: "",
  descricao: "",
  norma_ids: [],
  procedimentos: [{ ordem: "1", descricao: "", horario_inicio: "", horario_fim: "", setor_destino_id: "" }],
};

const selectClassName =
  "h-11 w-full rounded-2xl border border-sky-100/90 bg-white/95 px-4 text-sm text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-sky-200/55";

export function AssuntosPage() {
  const { hasPermission } = useAuth();
  const [items, setItems] = useState<Assunto[]>([]);
  const [normas, setNormas] = useState<Norma[]>([]);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Assunto | null>(null);
  const [form, setForm] = useState<AssuntoForm>(EMPTY_FORM);
  const canWrite = hasPermission("cadastro.assunto.write");

  async function load() {
    setLoading(true);
    try {
      const [nextItems, nextNormas, nextSetores] = await Promise.all([listAssuntos(), listNormas(), listSetores()]);
      setItems(nextItems);
      setNormas(nextNormas);
      setSetores(nextSetores);
      setError("");
    } catch (nextError) {
      setError(formatAppError(nextError, "Falha ao carregar assuntos."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return items;
    }
    return items.filter((item) => [item.nome, item.descricao ?? "", ...item.normas.map((norma) => norma.numero)].some((value) => value.toLowerCase().includes(normalized)));
  }, [items, query]);

  function openCreateDialog() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  }

  function openEditDialog(item: Assunto) {
    setEditing(item);
    setForm({
      nome: item.nome,
      descricao: item.descricao ?? "",
      norma_ids: item.normas.map((norma) => norma.id),
      procedimentos:
        item.procedimentos.length > 0
          ? item.procedimentos.map((proc) => ({
              ordem: String(proc.ordem),
              descricao: proc.descricao,
              horario_inicio: proc.horarioInicio ?? "",
              horario_fim: proc.horarioFim ?? "",
              setor_destino_id: proc.setorDestino?.id ?? "",
            }))
          : [{ ordem: "1", descricao: "", horario_inicio: "", horario_fim: "", setor_destino_id: "" }],
    });
    setOpen(true);
  }

  function updateProcedimento(index: number, next: Partial<ProcedimentoForm>) {
    setForm((current) => ({
      ...current,
      procedimentos: current.procedimentos.map((item, itemIndex) => (itemIndex === index ? { ...item, ...next } : item)),
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        nome: form.nome,
        descricao: form.descricao || null,
        norma_ids: form.norma_ids,
        procedimentos: form.procedimentos
          .filter((item) => item.descricao.trim().length > 0)
          .map((item, index) => ({
            ordem: item.ordem ? Number(item.ordem) : index + 1,
            descricao: item.descricao,
            horario_inicio: item.horario_inicio || null,
            horario_fim: item.horario_fim || null,
            setor_destino_id: item.setor_destino_id || null,
          })),
      };

      if (editing) {
        await updateAssunto(editing.id, payload);
      } else {
        await createAssunto(payload);
      }

      setOpen(false);
      await load();
    } catch (nextError) {
      setError(formatAppError(nextError, "Falha ao guardar assunto."));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <LoadingState title="Carregando assuntos" description="Preparando a biblioteca de assuntos, normas e fluxos de procedimento." />;
  }

  if (error && !items.length) {
    return <ErrorState title="Assuntos indisponiveis" description={error} />;
  }

  return (
    <section className="grid gap-6">
      <PageHeader
        eyebrow="Cadastros"
        title="Assuntos"
        description="Catalogo de assuntos com normas vinculadas e fluxo de procedimento para gerar checklist automaticamente nos processos."
      />

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Repositorio de assuntos</CardTitle>
            <CardDescription>Férias, auxílio alimentação, inspeção carcerária e outros fluxos reutilizáveis.</CardDescription>
          </div>
          <div className="flex w-full gap-3 md:w-auto">
            <Input className="md:w-80" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por assunto ou norma" />
            {canWrite ? <Button onClick={openCreateDialog}>Novo assunto</Button> : null}
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <EmptyState title="Nenhum assunto encontrado" description="Crie um assunto com normas e passos de procedimento para reutilizar nos processos." />
          ) : (
            <div className="grid gap-4">
              {filtered.map((item) => (
                <div className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm" key={item.id}>
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold text-slate-950">{item.nome}</h3>
                      {item.descricao ? <p className="text-sm text-slate-600">{item.descricao}</p> : null}
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {item.normas.length} normas vinculadas • {item.procedimentos.length} passos
                      </p>
                    </div>
                    {canWrite ? (
                      <Button onClick={() => openEditDialog(item)} size="sm" variant="outline">
                        Editar
                      </Button>
                    ) : null}
                  </div>
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">Normas</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {item.normas.length ? item.normas.map((norma) => (
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700" key={norma.id}>
                            {norma.numero}
                          </span>
                        )) : <span className="text-sm text-slate-500">Sem normas vinculadas.</span>}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-950">Fluxo de procedimento</p>
                      <ol className="mt-2 grid gap-2 text-sm text-slate-700">
                        {item.procedimentos.map((procedimento) => (
                          <li className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2" key={procedimento.id}>
                            <span className="font-semibold">{procedimento.ordem}. </span>
                            {procedimento.descricao}
                            {procedimento.setorDestino ? <span className="ml-2 text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">→ {procedimento.setorDestino.sigla}</span> : null}
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar assunto" : "Novo assunto"}</DialogTitle>
            <DialogDescription>Defina as normas relacionadas e a sequência do procedimento que será transformada em checklist no processo.</DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Nome do assunto">
                <Input value={form.nome} onChange={(event) => setForm((current) => ({ ...current, nome: event.target.value }))} />
              </FormField>
              <FormField label="Descricao">
                <Textarea rows={3} value={form.descricao} onChange={(event) => setForm((current) => ({ ...current, descricao: event.target.value }))} />
              </FormField>
            </div>

            <div className="grid gap-3 rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
              <p className="text-sm font-semibold text-slate-950">Normas vinculadas</p>
              <div className="grid gap-2 md:grid-cols-2">
                {normas.map((norma) => (
                  <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm" key={norma.id}>
                    <input
                      checked={form.norma_ids.includes(norma.id)}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          norma_ids: event.target.checked ? [...current.norma_ids, norma.id] : current.norma_ids.filter((item) => item !== norma.id),
                        }))
                      }
                      type="checkbox"
                    />
                    <span>{norma.numero} • {norma.origem}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-3 rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-950">Fluxo de procedimento</p>
                <Button
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      procedimentos: [...current.procedimentos, { ordem: String(current.procedimentos.length + 1), descricao: "", horario_inicio: "", horario_fim: "", setor_destino_id: "" }],
                    }))
                  }
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Adicionar passo
                </Button>
              </div>
              <div className="grid gap-3">
                {form.procedimentos.map((item, index) => (
                  <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 md:grid-cols-[90px_1fr_140px_140px_220px_80px]" key={`proc-${index}`}>
                    <FormField label="Ordem">
                      <Input type="number" min="1" value={item.ordem} onChange={(event) => updateProcedimento(index, { ordem: event.target.value })} />
                    </FormField>
                    <FormField label="Descricao">
                      <Input value={item.descricao} onChange={(event) => updateProcedimento(index, { descricao: event.target.value })} />
                    </FormField>
                    <FormField label="Inicio">
                      <Input type="time" value={item.horario_inicio} onChange={(event) => updateProcedimento(index, { horario_inicio: event.target.value })} />
                    </FormField>
                    <FormField label="Termino">
                      <Input type="time" value={item.horario_fim} onChange={(event) => updateProcedimento(index, { horario_fim: event.target.value })} />
                    </FormField>
                    <FormField label="Atualiza setor">
                      <select className={selectClassName} value={item.setor_destino_id} onChange={(event) => updateProcedimento(index, { setor_destino_id: event.target.value })}>
                        <option value="">Nao</option>
                        {setores.map((setor) => (
                          <option key={setor.id} value={setor.id}>{setor.sigla}</option>
                        ))}
                      </select>
                    </FormField>
                    <div className="flex items-end">
                      <Button
                        disabled={form.procedimentos.length === 1}
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            procedimentos: current.procedimentos.filter((_, itemIndex) => itemIndex !== index),
                          }))
                        }
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        Remover
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button onClick={() => setOpen(false)} type="button" variant="ghost">Cancelar</Button>
              <Button disabled={saving || form.nome.trim().length < 3 || form.procedimentos.every((item) => item.descricao.trim().length === 0)} type="submit">
                {saving ? "Salvando..." : editing ? "Salvar alteracoes" : "Criar assunto"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
