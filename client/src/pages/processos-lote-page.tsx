import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Loader2, PackageCheck, Send, UserPlus, XCircle } from "lucide-react";
import { FormField } from "../components/form-field";
import { PageHeader } from "../components/page-header";
import { EmptyState, ErrorState, LoadingState } from "../components/states";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import {
  createPessoa,
  createPreDemandasLote,
  formatAppError,
  listAssuntos,
  listPessoas,
  listPreDemandaPacotes,
} from "../lib/api";
import { buildPreDemandaPath } from "../lib/pre-demanda-path";
import type {
  Assunto,
  Pessoa,
  PreDemandaLoteResult,
  PreDemandaPacote,
  PreDemandaPacoteAssunto,
} from "../types";

const selectClassName =
  "h-11 w-full rounded-2xl border border-sky-100/90 bg-white/95 px-4 text-sm text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-sky-200/55";

function getPacoteAssunto(item: PreDemandaPacoteAssunto | Assunto) {
  return "assunto" in item ? item.assunto : item;
}

function getPacoteAssuntos(pacote: PreDemandaPacote | null) {
  if (!pacote) {
    return [];
  }

  return pacote.assuntos.map(getPacoteAssunto);
}

export function ProcessosLotePage() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [assuntos, setAssuntos] = useState<Assunto[]>([]);
  const [pacotes, setPacotes] = useState<PreDemandaPacote[]>([]);
  const [selectedPacoteId, setSelectedPacoteId] = useState("");
  const [selectedAssuntoIds, setSelectedAssuntoIds] = useState<string[]>([]);
  const [pessoaQuery, setPessoaQuery] = useState("");
  const [pessoaResults, setPessoaResults] = useState<Pessoa[]>([]);
  const [searchingPessoa, setSearchingPessoa] = useState(false);
  const [selectedPessoa, setSelectedPessoa] = useState<Pessoa | null>(null);
  const [newPessoa, setNewPessoa] = useState({ nome: "", cargo: "", cpf: "" });
  const [creatingPessoa, setCreatingPessoa] = useState(false);
  const [pessoaError, setPessoaError] = useState("");
  const [form, setForm] = useState({
    data_referencia: new Date().toISOString().slice(0, 10),
    prazo_processo: "",
    fonte: "",
    observacoes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [result, setResult] = useState<PreDemandaLoteResult | null>(null);

  const selectedPacote = useMemo(
    () => pacotes.find((item) => item.id === selectedPacoteId) ?? null,
    [pacotes, selectedPacoteId],
  );

  const selectedAssuntos = useMemo(() => {
    const byId = new Map(assuntos.map((item) => [item.id, item]));
    return selectedAssuntoIds
      .map((id) => byId.get(id))
      .filter((item): item is Assunto => Boolean(item));
  }, [assuntos, selectedAssuntoIds]);

  const availableExtraAssuntos = useMemo(
    () => assuntos.filter((item) => !selectedAssuntoIds.includes(item.id)),
    [assuntos, selectedAssuntoIds],
  );

  const submitBlockMessage = useMemo(() => {
    if (!selectedPessoa) {
      return "Selecione ou cadastre uma pessoa antes de criar os processos.";
    }
    if (!selectedAssuntoIds.length) {
      return "Selecione um pacote ou adicione ao menos um assunto.";
    }
    if (!form.data_referencia) {
      return "Informe a data de referencia.";
    }
    if (!form.prazo_processo) {
      return "Informe o prazo do processo.";
    }
    return "";
  }, [form.data_referencia, form.prazo_processo, selectedAssuntoIds.length, selectedPessoa]);

  async function load() {
    setLoading(true);
    try {
      const [nextAssuntos, nextPacotes] = await Promise.all([
        listAssuntos(),
        listPreDemandaPacotes(),
      ]);
      setAssuntos(nextAssuntos);
      setPacotes(nextPacotes.filter((item) => item.ativo !== false));
      setLoadError("");
    } catch (error) {
      setLoadError(formatAppError(error, "Falha ao carregar pacotes e assuntos."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const trimmed = pessoaQuery.trim();
    if (trimmed.length < 2 || selectedPessoa) {
      setPessoaResults([]);
      setSearchingPessoa(false);
      return;
    }

    const timer = window.setTimeout(async () => {
      setSearchingPessoa(true);
      try {
        const response = await listPessoas({ q: trimmed, page: 1, pageSize: 6 });
        setPessoaResults(response.items);
      } catch {
        setPessoaResults([]);
      } finally {
        setSearchingPessoa(false);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [pessoaQuery, selectedPessoa]);

  function selectPacote(pacoteId: string) {
    setSelectedPacoteId(pacoteId);
    const pacote = pacotes.find((item) => item.id === pacoteId) ?? null;
    setSelectedAssuntoIds(getPacoteAssuntos(pacote).map((item) => item.id));
    setResult(null);
    setSubmitError("");
  }

  function addAssunto(assuntoId: string) {
    if (!assuntoId) {
      return;
    }
    setSelectedAssuntoIds((current) =>
      current.includes(assuntoId) ? current : [...current, assuntoId],
    );
    setResult(null);
  }

  function removeAssunto(assuntoId: string) {
    setSelectedAssuntoIds((current) => current.filter((item) => item !== assuntoId));
    setResult(null);
  }

  async function handleCreatePessoa() {
    if (creatingPessoa || newPessoa.nome.trim().length < 3) {
      return;
    }

    setCreatingPessoa(true);
    setPessoaError("");
    try {
      const pessoa = await createPessoa({
        nome: newPessoa.nome.trim(),
        cargo: newPessoa.cargo.trim() || null,
        cpf: newPessoa.cpf.trim() || null,
      });
      setSelectedPessoa(pessoa);
      setPessoaQuery(pessoa.nome);
      setPessoaResults([]);
      setNewPessoa({ nome: "", cargo: "", cpf: "" });
    } catch (error) {
      setPessoaError(formatAppError(error, "Falha ao cadastrar pessoa."));
    } finally {
      setCreatingPessoa(false);
    }
  }

  async function handleSubmit() {
    if (submitting || submitBlockMessage || !selectedPessoa) {
      return;
    }

    setSubmitting(true);
    setSubmitError("");
    setResult(null);
    try {
      const nextResult = await createPreDemandasLote({
        pacote_id: selectedPacoteId || null,
        assunto_ids: selectedAssuntoIds,
        pessoas: [{ pessoa_id: selectedPessoa.id }],
        data_referencia: form.data_referencia,
        prazo_processo: form.prazo_processo,
        fonte: form.fonte.trim() || null,
        observacoes: form.observacoes.trim() || null,
      });
      setResult(nextResult);
    } catch (error) {
      setSubmitError(formatAppError(error, "Falha ao criar processos em lote."));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <LoadingState title="Carregando pacotes" description="Buscando pessoas, pacotes e assuntos para criacao em lote." />;
  }

  if (loadError) {
    return <ErrorState title="Processos em lote indisponiveis" description={loadError} />;
  }

  return (
    <section className="grid gap-6">
      <PageHeader
        eyebrow="Cadastro em lote"
        title="Processos em lote"
        description="Selecione uma pessoa e um pacote de assuntos para abrir varios processos pre-SEI com os mesmos metadados operacionais."
      />

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle>Pessoa e pacote</CardTitle>
            <CardDescription>
              A pessoa sera vinculada como solicitante e cada assunto revisado abaixo gerara um processo.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <section className="grid gap-3 rounded-[24px] border border-slate-200 bg-white/80 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950">Pessoa solicitante</p>
                  <p className="text-xs text-slate-500">Busque uma pessoa existente ou cadastre rapidamente.</p>
                </div>
                {selectedPessoa ? (
                  <Button
                    onClick={() => {
                      setSelectedPessoa(null);
                      setPessoaQuery("");
                    }}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    Trocar
                  </Button>
                ) : null}
              </div>

              <FormField label="Buscar pessoa">
                <Input
                  disabled={Boolean(selectedPessoa)}
                  onChange={(event) => setPessoaQuery(event.target.value)}
                  placeholder="Nome, matricula ou CPF"
                  value={pessoaQuery}
                />
              </FormField>

              {selectedPessoa ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                  <p className="font-semibold">{selectedPessoa.nome}</p>
                  <p className="mt-1 text-emerald-800">
                    {selectedPessoa.cargo ?? selectedPessoa.matricula ?? selectedPessoa.cpf ?? "Pessoa selecionada"}
                  </p>
                </div>
              ) : searchingPessoa ? (
                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Buscando pessoas...
                </div>
              ) : pessoaResults.length ? (
                <div className="grid gap-2">
                  {pessoaResults.map((item) => (
                    <button
                      className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm hover:border-sky-200 hover:bg-sky-50/60"
                      key={item.id}
                      onClick={() => {
                        setSelectedPessoa(item);
                        setPessoaQuery(item.nome);
                      }}
                      type="button"
                    >
                      <span>
                        <span className="block font-semibold text-slate-950">{item.nome}</span>
                        <span className="block text-slate-500">
                          {item.cargo ?? item.matricula ?? item.cpf ?? "Sem identificador adicional"}
                        </span>
                      </span>
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Selecionar</span>
                    </button>
                  ))}
                </div>
              ) : null}

              {!selectedPessoa ? (
                <div className="grid gap-3 rounded-[22px] border border-slate-200 bg-slate-50/80 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                    <UserPlus className="h-4 w-4" />
                    Cadastro rapido
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <FormField label="Nome">
                      <Input
                        onChange={(event) => setNewPessoa((current) => ({ ...current, nome: event.target.value }))}
                        value={newPessoa.nome}
                      />
                    </FormField>
                    <FormField label="Cargo">
                      <Input
                        onChange={(event) => setNewPessoa((current) => ({ ...current, cargo: event.target.value }))}
                        value={newPessoa.cargo}
                      />
                    </FormField>
                    <FormField label="CPF">
                      <Input
                        onChange={(event) => setNewPessoa((current) => ({ ...current, cpf: event.target.value }))}
                        value={newPessoa.cpf}
                      />
                    </FormField>
                  </div>
                  {pessoaError ? (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                      {pessoaError}
                    </div>
                  ) : null}
                  <Button
                    disabled={creatingPessoa || newPessoa.nome.trim().length < 3}
                    onClick={handleCreatePessoa}
                    type="button"
                    variant="outline"
                  >
                    {creatingPessoa ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                    Cadastrar e selecionar
                  </Button>
                </div>
              ) : null}
            </section>

            <section className="grid gap-4 rounded-[24px] border border-slate-200 bg-white/80 p-4">
              <FormField label="Pacote">
                <select
                  className={selectClassName}
                  onChange={(event) => selectPacote(event.target.value)}
                  value={selectedPacoteId}
                >
                  <option value="">Selecione um pacote</option>
                  {pacotes.map((pacote) => (
                    <option key={pacote.id} value={pacote.id}>
                      {pacote.nome}
                    </option>
                  ))}
                </select>
              </FormField>

              {selectedPacote ? (
                <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                  <div className="flex items-center gap-2 font-semibold">
                    <PackageCheck className="h-4 w-4" />
                    {selectedPacote.nome}
                  </div>
                  <p className="mt-1 text-sky-800">
                    {getPacoteAssuntos(selectedPacote).length} assunto(s) carregado(s) para revisao.
                  </p>
                </div>
              ) : pacotes.length === 0 ? (
                <EmptyState
                  title="Nenhum pacote cadastrado"
                  description="Cadastre pacotes para acelerar a abertura de processos recorrentes."
                />
              ) : null}

              <FormField label="Adicionar assunto avulso">
                <select className={selectClassName} onChange={(event) => addAssunto(event.target.value)} value="">
                  <option value="">Selecione para adicionar</option>
                  {availableExtraAssuntos.map((assunto) => (
                    <option key={assunto.id} value={assunto.id}>
                      {assunto.nome}
                    </option>
                  ))}
                </select>
              </FormField>
            </section>
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Revisar assuntos</CardTitle>
              <CardDescription>
                Remova itens que nao devem virar processo neste lote antes de enviar.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {selectedAssuntos.length ? (
                selectedAssuntos.map((assunto, index) => (
                  <div className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4" key={assunto.id}>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Processo {index + 1}
                      </p>
                      <p className="mt-1 font-semibold text-slate-950">{assunto.nome}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {assunto.procedimentos.length} passo(s) de procedimento.
                      </p>
                    </div>
                    <Button onClick={() => removeAssunto(assunto.id)} size="sm" type="button" variant="ghost">
                      Remover
                    </Button>
                  </div>
                ))
              ) : (
                <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                  Nenhum assunto selecionado.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Dados do lote</CardTitle>
              <CardDescription>
                Estes dados serao repetidos em todos os processos criados.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Data de referencia">
                  <Input
                    onChange={(event) => setForm((current) => ({ ...current, data_referencia: event.target.value }))}
                    type="date"
                    value={form.data_referencia}
                  />
                </FormField>
                <FormField label="Prazo do processo">
                  <Input
                    onChange={(event) => setForm((current) => ({ ...current, prazo_processo: event.target.value }))}
                    type="date"
                    value={form.prazo_processo}
                  />
                </FormField>
              </div>
              <FormField label="Fonte">
                <Input
                  onChange={(event) => setForm((current) => ({ ...current, fonte: event.target.value }))}
                  placeholder="E-mail, WhatsApp, oficio..."
                  value={form.fonte}
                />
              </FormField>
              <FormField label="Observacoes">
                <Textarea
                  onChange={(event) => setForm((current) => ({ ...current, observacoes: event.target.value }))}
                  rows={5}
                  value={form.observacoes}
                />
              </FormField>

              {submitBlockMessage ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  {submitBlockMessage}
                </div>
              ) : null}

              {submitError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {submitError}
                </div>
              ) : null}

              <Button disabled={Boolean(submitBlockMessage) || submitting} onClick={handleSubmit} type="button">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Criar processos em lote
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {result ? (
        <Card>
          <CardHeader>
            <CardTitle>Resultado da criacao</CardTitle>
            <CardDescription>
              {result.createdCount} criado(s) e {result.idempotentCount} ja existente(s) em {result.total} assunto(s).
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800">
                <CheckCircle2 className="h-4 w-4" />
                {result.createdCount} criado(s)
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800">
                <XCircle className="h-4 w-4" />
                {result.idempotentCount} existente(s)
              </span>
            </div>
            <div className="grid gap-3">
              {result.items.map((item, index) => {
                const preId = item.preId || item.existingPreId || item.record.preId;
                return (
                  <div
                    className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4"
                    key={`${item.assuntoId}-${index}`}
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-950">{item.assuntoNome}</p>
                      <p className={`mt-1 text-sm ${item.idempotent ? "text-amber-700" : "text-emerald-700"}`}>
                        {item.idempotent ? "Processo existente localizado por idempotencia." : "Processo criado."}
                      </p>
                      {preId ? <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{preId}</p> : null}
                    </div>
                    {preId ? (
                      <Link className="text-sm font-semibold text-sky-700 hover:text-sky-900" to={buildPreDemandaPath(preId)}>
                        Abrir processo
                      </Link>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
