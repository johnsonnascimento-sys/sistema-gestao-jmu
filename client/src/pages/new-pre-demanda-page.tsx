import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FormField } from "../components/form-field";
import { PageHeader } from "../components/page-header";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { addPreDemandaInteressado, ApiError, appendRequestReference, createPreDemanda, formatAppError, listAssuntos, listPessoas } from "../lib/api";
import { formatNumeroJudicialInput, isValidNumeroJudicial } from "../lib/numero-judicial";
import { formatSeiInput, isValidSei } from "../lib/sei";
import type { Assunto, Pessoa } from "../types";

type EntryType = "existing" | "eventual" | "continuous";

function getConflictPreId(details: unknown) {
  if (!details || typeof details !== "object") {
    return null;
  }

  const maybePreId = (details as Record<string, unknown>).existingPreId ?? (details as Record<string, unknown>).preId;
  return typeof maybePreId === "string" && maybePreId.length > 0 ? maybePreId : null;
}

export function NewPreDemandaPage() {
  const [entryType, setEntryType] = useState<EntryType>("eventual");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [form, setForm] = useState({
    assunto: "",
    data_referencia: new Date().toISOString().slice(0, 10),
    descricao: "",
    fonte: "",
    observacoes: "",
    sei_numero: "",
    prazo_processo: "",
    numero_judicial: "",
    pagamento_envolvido: false,
    urgente: false,
  });
  const [error, setError] = useState("");
  const [conflictPreId, setConflictPreId] = useState<string | null>(null);
  const [result, setResult] = useState<{ preId: string; idempotent: boolean } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [interessadoSearch, setInteressadoSearch] = useState("");
  const [interessadoResults, setInteressadoResults] = useState<Pessoa[]>([]);
  const [selectedInteressados, setSelectedInteressados] = useState<Pessoa[]>([]);
  const [assuntos, setAssuntos] = useState<Assunto[]>([]);
  const [selectedAssuntoIds, setSelectedAssuntoIds] = useState<string[]>([]);

  const showNumbers = entryType === "existing";
  const isSeiValid = !form.sei_numero || isValidSei(form.sei_numero);
  const isNumeroJudicialValid = !form.numero_judicial || isValidNumeroJudicial(form.numero_judicial);
  const isSubmitBlocked = isSubmitting || !form.assunto.trim() || !form.prazo_processo || (showNumbers && !isSeiValid) || !isNumeroJudicialValid;

  useEffect(() => {
    void (async () => {
      try {
        setAssuntos(await listAssuntos());
      } catch {
        setAssuntos([]);
      }
    })();
  }, []);

  useEffect(() => {
    if (interessadoSearch.trim().length < 2) {
      setInteressadoResults([]);
      return;
    }

    let active = true;
    void (async () => {
      try {
        const result = await listPessoas({ q: interessadoSearch, page: 1, pageSize: 8 });
        if (active) {
          setInteressadoResults(result.items.filter((item) => !selectedInteressados.some((selected) => selected.id === item.id)));
        }
      } catch {
        if (active) {
          setInteressadoResults([]);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [interessadoSearch, selectedInteressados]);

  function addInteressado(pessoa: Pessoa) {
    setSelectedInteressados((current) => [...current, pessoa]);
    setInteressadoSearch("");
    setInteressadoResults([]);
  }

  function removeInteressado(pessoaId: string) {
    setSelectedInteressados((current) => current.filter((item) => item.id !== pessoaId));
  }

  function updateEntryType(nextType: EntryType) {
    setEntryType(nextType);
    setAdvancedOpen(false);
    setForm((current) => ({
      ...current,
      sei_numero: nextType === "existing" ? current.sei_numero : "",
      numero_judicial: nextType === "existing" ? current.numero_judicial : "",
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    setConflictPreId(null);
    setResult(null);

    try {
      const created = await createPreDemanda({
        solicitante: selectedInteressados[0]?.nome ?? undefined,
        assunto: form.assunto,
        data_referencia: form.data_referencia,
        descricao: form.descricao || undefined,
        fonte: form.fonte || undefined,
        observacoes: form.observacoes || undefined,
        sei_numero: showNumbers ? form.sei_numero || null : null,
        prazo_processo: form.prazo_processo,
        numero_judicial: showNumbers ? form.numero_judicial || null : null,
        assunto_ids: selectedAssuntoIds,
        metadata: {
          pagamento_envolvido: form.pagamento_envolvido,
          urgente: form.urgente,
        },
      });

      if (!created.idempotent && selectedInteressados.length > 0) {
        await Promise.all(
          selectedInteressados.map((pessoa) =>
            addPreDemandaInteressado(created.preId, {
              interessado_id: pessoa.id,
              papel: "interessado",
            }),
          ),
        );
      }

      setResult({
        preId: created.existingPreId ?? created.preId,
        idempotent: created.idempotent,
      });
    } catch (nextError) {
      if (nextError instanceof ApiError && nextError.status === 409) {
        setConflictPreId(getConflictPreId(nextError.details));
        setError(appendRequestReference("Ja existe um processo registrado com estes dados.", nextError.requestId));
      } else {
        setError(formatAppError(nextError, "Falha ao criar processo."));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="grid gap-6">
      <PageHeader description="Cadastro com prazo geral do processo e flags operacionais. A recorrencia fica nas tarefas." eyebrow="Cadastro" title="Novo Processo" />

      <Card>
        <CardContent className="p-6">
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
            <div className="md:col-span-2 grid gap-3 rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(240,246,249,0.88))] px-5 py-4 shadow-[0_14px_32px_rgba(20,33,61,0.05)]">
              <FormField label="Pessoas interessadas">
                <Input onChange={(event) => setInteressadoSearch(event.target.value)} placeholder="Buscar pessoas para vincular como interessadas" value={interessadoSearch} />
              </FormField>

              {selectedInteressados.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {selectedInteressados.map((item) => (
                    <button className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-900" key={item.id} onClick={() => removeInteressado(item.id)} type="button">
                      {item.nome} x
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">Nenhuma pessoa interessada selecionada.</p>
              )}

              {interessadoResults.length > 0 ? (
                <div className="grid gap-2">
                  {interessadoResults.map((item) => (
                    <button className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm hover:border-slate-300" key={item.id} onClick={() => addInteressado(item)} type="button">
                      <span>
                        <span className="block font-semibold text-slate-950">{item.nome}</span>
                        <span className="block text-slate-500">{item.cargo ?? item.cpf ?? item.matricula ?? "Sem identificador adicional"}</span>
                      </span>
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Adicionar</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="md:col-span-2 grid gap-3 rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(240,246,249,0.88))] px-5 py-4 shadow-[0_14px_32px_rgba(20,33,61,0.05)]">
              <p className="text-sm font-semibold text-slate-950">Tipo de entrada</p>
              <div className="grid gap-3 md:grid-cols-3">
                <EntryOption checked={entryType === "existing"} description="Ja chega com numeracao de origem." label="Processo existente" onChange={() => updateEntryType("existing")} />
                <EntryOption checked={entryType === "eventual"} description="Fluxo normal aguardando numeracao." label="Pre-SEI" onChange={() => updateEntryType("eventual")} />
                <EntryOption checked={entryType === "continuous"} description="Fluxo sem numero principal na abertura." label="Sem numero" onChange={() => updateEntryType("continuous")} />
              </div>
            </div>

            <FormField label="Assunto">
              <Input onChange={(event) => setForm((current) => ({ ...current, assunto: event.target.value }))} value={form.assunto} />
            </FormField>

            <FormField label="Prazo do processo *">
              <Input onChange={(event) => setForm((current) => ({ ...current, prazo_processo: event.target.value }))} type="date" value={form.prazo_processo} />
            </FormField>

            <div className="md:col-span-2 grid gap-3 rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(240,246,249,0.88))] px-5 py-4 shadow-[0_14px_32px_rgba(20,33,61,0.05)]">
              <div>
                <p className="text-sm font-semibold text-slate-950">Assuntos vinculados</p>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">Assuntos com procedimentos criam tarefas automáticas ao salvar.</p>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {assuntos.map((assunto) => (
                  <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm" key={assunto.id}>
                    <input checked={selectedAssuntoIds.includes(assunto.id)} onChange={(event) => setSelectedAssuntoIds((current) => event.target.checked ? [...current, assunto.id] : current.filter((item) => item !== assunto.id))} type="checkbox" />
                    <span>
                      <span className="block font-semibold text-slate-950">{assunto.nome}</span>
                      <span className="block text-slate-500">{assunto.procedimentos.length} passos</span>
                    </span>
                  </label>
                ))}
              </div>
              {selectedAssuntoIds.length ? (
                <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                  <p className="font-semibold">Resumo dos vinculados</p>
                  <p className="mt-1 text-sky-800">
                    {selectedAssuntoIds.length} assunto{selectedAssuntoIds.length === 1 ? "" : "s"} selecionado{selectedAssuntoIds.length === 1 ? "" : "s"}.
                    {assuntos.some((assunto) => selectedAssuntoIds.includes(assunto.id) && assunto.procedimentos.length > 0)
                      ? " Este processo vai nascer com checklist automático."
                      : " Nenhum dos selecionados possui procedimentos automáticos."}
                  </p>
                </div>
              ) : null}
            </div>

            <FormField label="Data de referencia">
              <Input onChange={(event) => setForm((current) => ({ ...current, data_referencia: event.target.value }))} type="date" value={form.data_referencia} />
            </FormField>

            <FormField label="Fonte">
              <Input onChange={(event) => setForm((current) => ({ ...current, fonte: event.target.value }))} placeholder="WhatsApp, e-mail, telefone..." value={form.fonte} />
            </FormField>

            <FormField className="md:col-span-2" label="Descricao">
              <Textarea onChange={(event) => setForm((current) => ({ ...current, descricao: event.target.value }))} rows={5} value={form.descricao} />
            </FormField>

            <FormField className="md:col-span-2" label="Observacoes">
              <Textarea onChange={(event) => setForm((current) => ({ ...current, observacoes: event.target.value }))} rows={4} value={form.observacoes} />
            </FormField>

            {showNumbers ? (
              <>
                <FormField label="Numero SEI" hint={<code>000181/26-02.227</code>}>
                  <Input onChange={(event) => setForm((current) => ({ ...current, sei_numero: formatSeiInput(event.target.value) }))} placeholder="000181/26-02.227" value={form.sei_numero} />
                </FormField>

                <FormField label="Numero judicial">
                  <Input onChange={(event) => setForm((current) => ({ ...current, numero_judicial: formatNumeroJudicialInput(event.target.value) ?? "" }))} placeholder="0000000-00.0000.0.00.0000" value={form.numero_judicial} />
                </FormField>
              </>
            ) : null}

            <div className="md:col-span-2 rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(247,241,233,0.82))] px-5 py-4 shadow-[0_14px_32px_rgba(20,33,61,0.05)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950">Campos avancados</p>
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">marcadores operacionais do processo</p>
                </div>
                <Button onClick={() => setAdvancedOpen((current) => !current)} size="sm" type="button" variant="ghost">
                  {advancedOpen ? "Ocultar" : "Mostrar"}
                </Button>
              </div>

              {advancedOpen ? (
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <span>
                      <span className="block text-sm font-semibold text-slate-950">Envolve pagamento</span>
                      <span className="block text-xs text-slate-500">Marca o processo em filtros e dashboard.</span>
                    </span>
                    <input checked={form.pagamento_envolvido} className="h-5 w-5 accent-slate-950" onChange={(event) => setForm((current) => ({ ...current, pagamento_envolvido: event.target.checked }))} type="checkbox" />
                  </label>

                  <label className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
                    <span>
                      <span className="block text-sm font-semibold text-slate-950">Marcar como urgente</span>
                      <span className="block text-xs text-slate-500">Destaca o processo no dashboard e nas filas.</span>
                    </span>
                    <input checked={form.urgente} className="h-5 w-5 accent-rose-600" onChange={(event) => setForm((current) => ({ ...current, urgente: event.target.checked }))} type="checkbox" />
                  </label>

                  <p className="md:col-span-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Tarefas recorrentes sao configuradas no detalhe do processo, cada uma com prazo proprio de conclusao.</p>
                </div>
              ) : null}
            </div>

            {error ? (
              <div className="md:col-span-2 rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                {error} {conflictPreId ? <Link className="underline" to={`/pre-demandas/${conflictPreId}`}>Abrir processo existente</Link> : null}
              </div>
            ) : null}

            {showNumbers && !isSeiValid ? (
              <div className="md:col-span-2 rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                Informe um numero SEI valido no formato <code>000181/26-02.227</code>.
              </div>
            ) : null}

            {result ? (
              <div className="md:col-span-2 rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                {result.idempotent ? "Processo existente localizado." : "Processo criado com sucesso."} <Link className="underline" to={`/pre-demandas/${result.preId}`}>{result.preId}</Link>
              </div>
            ) : null}

            <div className="md:col-span-2 flex justify-end">
              <Button disabled={isSubmitBlocked} type="submit">
                {isSubmitting ? "Salvando..." : "Salvar processo"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}

function EntryOption({
  checked,
  label,
  description,
  onChange,
}: {
  checked: boolean;
  label: string;
  description: string;
  onChange: () => void;
}) {
  return (
    <label
      className={`grid gap-2 rounded-[24px] border px-4 py-4 text-sm shadow-[0_12px_26px_rgba(20,33,61,0.04)] ${
        checked
          ? "border-transparent bg-[linear-gradient(145deg,#0f2b46,#1d4ed8_55%,#0f766e)] text-white"
          : "border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(247,241,233,0.82))] text-slate-950"
      }`}
    >
      <input checked={checked} className="sr-only" name="entry-type" onChange={onChange} type="radio" />
      <span className="font-semibold">{label}</span>
      <span className={checked ? "text-slate-200" : "text-slate-500"}>{description}</span>
    </label>
  );
}
