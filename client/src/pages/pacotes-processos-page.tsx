import { FormEvent, useEffect, useMemo, useState } from "react";
import { PackagePlus } from "lucide-react";
import { FormField } from "../components/form-field";
import { PageHeader } from "../components/page-header";
import { EmptyState, ErrorState, LoadingState } from "../components/states";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import {
  createPreDemandaPacote,
  formatAppError,
  listAssuntos,
  listPreDemandaPacotes,
} from "../lib/api";
import type { Assunto, PreDemandaPacote } from "../types";

type PacoteForm = {
  nome: string;
  descricao: string;
  assunto_ids: string[];
};

const EMPTY_FORM: PacoteForm = {
  nome: "",
  descricao: "",
  assunto_ids: [],
};

const selectClassName =
  "h-11 w-full rounded-2xl border border-sky-100/90 bg-white/95 px-4 text-sm text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-sky-200/55";

function getPacoteAssuntoNome(item: PreDemandaPacote["assuntos"][number] | Assunto) {
  return "assunto" in item ? item.assunto.nome : item.nome;
}

export function PacotesProcessosPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pacotes, setPacotes] = useState<PreDemandaPacote[]>([]);
  const [assuntos, setAssuntos] = useState<Assunto[]>([]);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<PacoteForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const selectedAssuntos = useMemo(() => {
    const byId = new Map(assuntos.map((item) => [item.id, item]));
    return form.assunto_ids
      .map((id) => byId.get(id))
      .filter((item): item is Assunto => Boolean(item));
  }, [assuntos, form.assunto_ids]);

  const availableAssuntos = useMemo(
    () => assuntos.filter((item) => !form.assunto_ids.includes(item.id)),
    [assuntos, form.assunto_ids],
  );

  const filteredPacotes = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return pacotes;
    }

    return pacotes.filter((pacote) =>
      [
        pacote.nome,
        pacote.descricao ?? "",
        ...pacote.assuntos.map(getPacoteAssuntoNome),
      ].some((value) => value.toLowerCase().includes(normalized)),
    );
  }, [pacotes, query]);

  async function load() {
    setLoading(true);
    try {
      const [nextPacotes, nextAssuntos] = await Promise.all([
        listPreDemandaPacotes(),
        listAssuntos(),
      ]);
      setPacotes(nextPacotes);
      setAssuntos(nextAssuntos);
      setError("");
    } catch (nextError) {
      setError(formatAppError(nextError, "Falha ao carregar temas."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function addAssunto(assuntoId: string) {
    if (!assuntoId) {
      return;
    }

    setForm((current) => ({
      ...current,
      assunto_ids: current.assunto_ids.includes(assuntoId)
        ? current.assunto_ids
        : [...current.assunto_ids, assuntoId],
    }));
  }

  function removeAssunto(assuntoId: string) {
    setForm((current) => ({
      ...current,
      assunto_ids: current.assunto_ids.filter((item) => item !== assuntoId),
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || form.nome.trim().length < 3 || form.assunto_ids.length === 0) {
      return;
    }

    setSaving(true);
    setSaveError("");
    try {
      await createPreDemandaPacote({
        nome: form.nome.trim(),
        descricao: form.descricao.trim() || null,
        assunto_ids: form.assunto_ids,
      });
      setForm(EMPTY_FORM);
      await load();
    } catch (nextError) {
      setSaveError(formatAppError(nextError, "Falha ao criar tema."));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <LoadingState title="Carregando temas" description="Preparando o cadastro de temas de processos." />;
  }

  if (error) {
    return <ErrorState title="Temas indisponiveis" description={error} />;
  }

  return (
    <section className="grid gap-6">
      <PageHeader
        eyebrow="Cadastros"
        title="Temas de processos"
        description="Agrupe assuntos em temas reutilizaveis para abrir processos em lote com menos repeticao manual."
      />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Novo tema</CardTitle>
            <CardDescription>
              Selecione os assuntos na ordem em que devem ser revisados na tela de criacao em lote.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={handleSubmit}>
              <FormField label="Nome">
                <Input
                  onChange={(event) => setForm((current) => ({ ...current, nome: event.target.value }))}
                  value={form.nome}
                />
              </FormField>
              <FormField label="Descricao">
                <Textarea
                  onChange={(event) => setForm((current) => ({ ...current, descricao: event.target.value }))}
                  rows={4}
                  value={form.descricao}
                />
              </FormField>
              <FormField label="Adicionar assunto">
                <select className={selectClassName} onChange={(event) => addAssunto(event.target.value)} value="">
                  <option value="">Selecione um assunto</option>
                  {availableAssuntos.map((assunto) => (
                    <option key={assunto.id} value={assunto.id}>
                      {assunto.nome}
                    </option>
                  ))}
                </select>
              </FormField>

              <div className="grid gap-3 rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-sm font-semibold text-slate-950">Assuntos do tema</p>
                {selectedAssuntos.length ? (
                  <div className="grid gap-2">
                    {selectedAssuntos.map((assunto, index) => (
                      <div className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3" key={assunto.id}>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                            Ordem {index + 1}
                          </p>
                          <p className="font-semibold text-slate-950">{assunto.nome}</p>
                          <p className="mt-1 text-sm text-slate-500">
                            {assunto.procedimentos.length} passo(s) de procedimento.
                          </p>
                        </div>
                        <Button onClick={() => removeAssunto(assunto.id)} size="sm" type="button" variant="ghost">
                          Remover
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
                    Nenhum assunto selecionado.
                  </p>
                )}
              </div>

              {saveError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {saveError}
                </div>
              ) : null}

              <Button disabled={saving || form.nome.trim().length < 3 || form.assunto_ids.length === 0} type="submit">
                <PackagePlus className="h-4 w-4" />
                {saving ? "Salvando..." : "Criar tema"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Temas cadastrados</CardTitle>
              <CardDescription>
                Temas ativos aparecem na tela Processos em lote.
              </CardDescription>
            </div>
            <Input
              className="md:w-80"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar tema ou assunto"
              value={query}
            />
          </CardHeader>
          <CardContent>
            {filteredPacotes.length ? (
              <div className="grid gap-4">
                {filteredPacotes.map((pacote) => (
                  <article className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm" key={pacote.id}>
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold text-slate-950">{pacote.nome}</h3>
                          {!pacote.ativo ? (
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                              Inativo
                            </span>
                          ) : null}
                        </div>
                        {pacote.descricao ? <p className="mt-1 text-sm text-slate-600">{pacote.descricao}</p> : null}
                        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          {pacote.assuntos.length} assunto(s)
                        </p>
                      </div>
                    </div>
                    <ol className="mt-4 grid gap-2">
                      {pacote.assuntos.map((item, index) => (
                        <li className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700" key={`${pacote.id}-${index}`}>
                          <span className="font-semibold">{index + 1}. </span>
                          {getPacoteAssuntoNome(item)}
                        </li>
                      ))}
                    </ol>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                title="Nenhum tema encontrado"
                description="Crie um tema com assuntos para reutilizar na abertura em lote."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
