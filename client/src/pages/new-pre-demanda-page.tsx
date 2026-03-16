import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FormField } from "../components/form-field";
import { PageHeader } from "../components/page-header";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { addPreDemandaInteressado, ApiError, appendRequestReference, createPreDemanda, formatAppError, listAssuntos, listPessoas } from "../lib/api";
import type { Assunto, Pessoa } from "../types";
import { formatSeiInput, isValidSei } from "../lib/sei";

type EntryType = "existing" | "eventual" | "continuous";

const WEEKDAY_OPTIONS = [
  { value: "seg", label: "Seg" },
  { value: "ter", label: "Ter" },
  { value: "qua", label: "Qua" },
  { value: "qui", label: "Qui" },
  { value: "sex", label: "Sex" },
  { value: "sab", label: "Sab" },
  { value: "dom", label: "Dom" },
] as const;

const selectClassName =
  "h-11 w-full rounded-2xl border border-sky-100/90 bg-white/95 px-4 text-sm text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-sky-200/55";

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
    pessoa_solicitante_id: "",
    assunto: "",
    data_referencia: new Date().toISOString().slice(0, 10),
    descricao: "",
    fonte: "",
    observacoes: "",
    sei_numero: "",
    prazo_inicial: "",
    prazo_intermediario: "",
    prazo_final: "",
    numero_judicial: "",
    pagamento_envolvido: false,
    frequencia: "",
    frequencia_dias_semana: [] as string[],
    frequencia_dia_mes: "",
  });
  const [error, setError] = useState("");
  const [conflictPreId, setConflictPreId] = useState<string | null>(null);
  const [result, setResult] = useState<{ preId: string; idempotent: boolean } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pessoaSearch, setPessoaSearch] = useState("");
  const [pessoaResults, setPessoaResults] = useState<Pessoa[]>([]);
  const [selectedPessoa, setSelectedPessoa] = useState<Pessoa | null>(null);
  const [interessadoSearch, setInteressadoSearch] = useState("");
  const [interessadoResults, setInteressadoResults] = useState<Pessoa[]>([]);
  const [selectedInteressados, setSelectedInteressados] = useState<Pessoa[]>([]);
  const [assuntos, setAssuntos] = useState<Assunto[]>([]);
  const [selectedAssuntoIds, setSelectedAssuntoIds] = useState<string[]>([]);
  const isSeiValid = !form.sei_numero || isValidSei(form.sei_numero);
  const isContinuous = entryType === "continuous";
  const showNumbers = entryType === "existing";
  const showAdvanced = advancedOpen || isContinuous;
  const hasContinuousFrequency = Boolean(form.frequencia.trim());
  const requiresPrazo = !hasContinuousFrequency;
  const isSubmitBlocked =
    isSubmitting || !form.pessoa_solicitante_id || (showNumbers && !isSeiValid) || (isContinuous && !form.frequencia.trim()) || (requiresPrazo && !form.prazo_final);

  useEffect(() => {
    void (async () => {
      try {
        setAssuntos(await listAssuntos());
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (pessoaSearch.trim().length < 2) {
      setPessoaResults([]);
      return;
    }
    let active = true;
    void (async () => {
      try {
        const result = await listPessoas({ q: pessoaSearch, page: 1, pageSize: 8 });
        if (active) {
          setPessoaResults(result.items);
        }
      } catch {
        if (active) {
          setPessoaResults([]);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [pessoaSearch]);

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
          setInteressadoResults(
            result.items.filter((item) => !selectedInteressados.some((selected) => selected.id === item.id)),
          );
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
  }, [form.pessoa_solicitante_id, interessadoSearch, selectedInteressados]);

  const frequenciaHint = useMemo(() => {
    if (form.frequencia === "Semanal" && form.frequencia_dias_semana.length) {
      return `Dias: ${form.frequencia_dias_semana.join(", ")}`;
    }

    if (form.frequencia === "Mensal" && form.frequencia_dia_mes) {
      return `Dia do mes: ${form.frequencia_dia_mes}`;
    }

    return "";
  }, [form.frequencia, form.frequencia_dia_mes, form.frequencia_dias_semana]);

  function updateEntryType(nextType: EntryType) {
    setEntryType(nextType);
    setAdvancedOpen(nextType === "continuous");
    setForm((current) => ({
      ...current,
      sei_numero: nextType === "existing" ? current.sei_numero : "",
      numero_judicial: nextType === "existing" ? current.numero_judicial : "",
      frequencia: nextType === "continuous" ? current.frequencia : current.frequencia,
      frequencia_dias_semana: nextType === "continuous" ? current.frequencia_dias_semana : [],
      frequencia_dia_mes: nextType === "continuous" ? current.frequencia_dia_mes : "",
    }));
  }

  function updateFrequencia(nextValue: string) {
    setForm((current) => ({
      ...current,
      frequencia: nextValue,
      frequencia_dias_semana: nextValue === "Semanal" ? current.frequencia_dias_semana : [],
      frequencia_dia_mes: nextValue === "Mensal" ? current.frequencia_dia_mes : "",
    }));
  }

  function toggleWeekday(day: string) {
    setForm((current) => ({
      ...current,
      frequencia_dias_semana: current.frequencia_dias_semana.includes(day)
        ? current.frequencia_dias_semana.filter((item) => item !== day)
        : [...current.frequencia_dias_semana, day],
    }));
  }

  function selectPessoaPrincipal(pessoa: Pessoa) {
    setSelectedPessoa(pessoa);
    setPessoaSearch(pessoa.nome);
    setPessoaResults([]);
    setForm((current) => ({ ...current, pessoa_solicitante_id: pessoa.id }));
  }

  function addInteressado(pessoa: Pessoa) {
    setSelectedInteressados((current) => [...current, pessoa]);
    setInteressadoSearch("");
    setInteressadoResults([]);
  }

  function removeInteressado(pessoaId: string) {
    setSelectedInteressados((current) => current.filter((item) => item.id !== pessoaId));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    setConflictPreId(null);
    setResult(null);

    try {
      const created = await createPreDemanda({
        pessoa_solicitante_id: form.pessoa_solicitante_id,
        assunto: form.assunto,
        data_referencia: form.data_referencia,
        descricao: form.descricao || undefined,
        fonte: form.fonte || undefined,
        observacoes: form.observacoes || undefined,
        sei_numero: showNumbers ? form.sei_numero || null : null,
        prazo_inicial: form.prazo_inicial || null,
        prazo_intermediario: form.prazo_intermediario || null,
        prazo_final: form.prazo_final || null,
        numero_judicial: showNumbers ? form.numero_judicial || null : null,
        assunto_ids: selectedAssuntoIds,
        metadata: {
          frequencia: form.frequencia || null,
          frequencia_dias_semana: form.frequencia === "Semanal" ? form.frequencia_dias_semana : null,
          frequencia_dia_mes: form.frequencia === "Mensal" && form.frequencia_dia_mes ? Number(form.frequencia_dia_mes) : null,
          pagamento_envolvido: form.pagamento_envolvido,
        },
      });

      if (!created.idempotent && selectedInteressados.length > 0) {
        await Promise.all(
          selectedInteressados
            .filter((pessoa) => pessoa.id !== form.pessoa_solicitante_id)
            .map((pessoa) =>
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
      <PageHeader
        description="Via rapida para processo externo, processo pre-SEI ou processo sem numero."
        eyebrow="Cadastro"
        title="Novo Processo"
      />

      <Card>
        <CardContent className="p-6">
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
            <div className="md:col-span-2 grid gap-3 rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(240,246,249,0.88))] px-5 py-4 shadow-[0_14px_32px_rgba(20,33,61,0.05)]">
              <FormField label="Pessoa principal">
                <Input onChange={(event) => setPessoaSearch(event.target.value)} placeholder="Buscar pessoa por nome, cargo, matrícula ou CPF" value={pessoaSearch} />
              </FormField>
              {form.pessoa_solicitante_id ? (
                <p className="text-sm font-medium text-emerald-700">
                  Pessoa selecionada: {selectedPessoa?.nome ?? "Vinculada"}
                </p>
              ) : null}
              {pessoaResults.length > 0 ? (
                <div className="grid gap-2">
                  {pessoaResults.map((item) => (
                    <button
                      className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm ${
                        form.pessoa_solicitante_id === item.id ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                      key={item.id}
                      onClick={() => selectPessoaPrincipal(item)}
                      type="button"
                    >
                      <span>
                        <span className="block font-semibold text-slate-950">{item.nome}</span>
                        <span className="block text-slate-500">{item.cargo ?? item.cpf ?? item.matricula ?? "Sem identificador adicional"}</span>
                      </span>
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Usar</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="md:col-span-2 grid gap-3 rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(240,246,249,0.88))] px-5 py-4 shadow-[0_14px_32px_rgba(20,33,61,0.05)]">
              <FormField label="Interessados">
                <Input onChange={(event) => setInteressadoSearch(event.target.value)} placeholder="Buscar pessoas para vincular como interessadas" value={interessadoSearch} />
              </FormField>

              {selectedInteressados.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {selectedInteressados.map((item) => (
                    <button
                      className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-900"
                      key={item.id}
                      onClick={() => removeInteressado(item.id)}
                      type="button"
                    >
                      {item.nome} ×
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">Nenhum interessado adicional selecionado.</p>
              )}

              {interessadoResults.length > 0 ? (
                <div className="grid gap-2">
                  {interessadoResults.map((item) => (
                    <button
                      className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm hover:border-slate-300"
                      key={item.id}
                      onClick={() => addInteressado(item)}
                      type="button"
                    >
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
              <p className="text-sm font-semibold text-slate-950">Tipo de Entrada</p>
              <div className="grid gap-3 md:grid-cols-3">
                <EntryOption
                  checked={entryType === "existing"}
                  description="Ja chega com numeracao de origem."
                  label="Processo Existente (Com Número)"
                  onChange={() => updateEntryType("existing")}
                />
                <EntryOption
                  checked={entryType === "eventual"}
                  description="Fluxo normal aguardando numeracao."
                  label="Processo Pré-SEI (Aguardará SEI)"
                  onChange={() => updateEntryType("eventual")}
                />
                <EntryOption
                  checked={entryType === "continuous"}
                  description="Fluxo sem número principal na abertura."
                  label="Processo Sem Número"
                  onChange={() => updateEntryType("continuous")}
                />
              </div>
            </div>

            <FormField label="Assunto">
              <Input onChange={(event) => setForm((current) => ({ ...current, assunto: event.target.value }))} value={form.assunto} />
            </FormField>

            <div className="md:col-span-2 grid gap-3 rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(240,246,249,0.88))] px-5 py-4 shadow-[0_14px_32px_rgba(20,33,61,0.05)]">
              <div>
                <p className="text-sm font-semibold text-slate-950">Assuntos vinculados</p>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">cada assunto gera checklist a partir do fluxo cadastrado</p>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {assuntos.map((assunto) => (
                  <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm" key={assunto.id}>
                    <input
                      checked={selectedAssuntoIds.includes(assunto.id)}
                      onChange={(event) =>
                        setSelectedAssuntoIds((current) =>
                          event.target.checked ? [...current, assunto.id] : current.filter((item) => item !== assunto.id),
                        )
                      }
                      type="checkbox"
                    />
                    <span>
                      <span className="block font-semibold text-slate-950">{assunto.nome}</span>
                      <span className="block text-slate-500">{assunto.procedimentos.length} passos • {assunto.normas.length} normas</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <FormField label="Data de referência">
              <Input onChange={(event) => setForm((current) => ({ ...current, data_referencia: event.target.value }))} type="date" value={form.data_referencia} />
            </FormField>

            <FormField label="Fonte">
              <Input onChange={(event) => setForm((current) => ({ ...current, fonte: event.target.value }))} placeholder="WhatsApp, e-mail, telefone..." value={form.fonte} />
            </FormField>

            <FormField className="md:col-span-2" label="Descrição">
              <Textarea onChange={(event) => setForm((current) => ({ ...current, descricao: event.target.value }))} rows={5} value={form.descricao} />
            </FormField>

            <FormField className="md:col-span-2" label="Observações">
              <Textarea onChange={(event) => setForm((current) => ({ ...current, observacoes: event.target.value }))} rows={4} value={form.observacoes} />
            </FormField>

            {showNumbers ? (
              <>
                <FormField label="Número SEI" hint={<code>000181/26-02.227</code>}>
                  <Input onChange={(event) => setForm((current) => ({ ...current, sei_numero: formatSeiInput(event.target.value) }))} placeholder="000181/26-02.227" value={form.sei_numero} />
                </FormField>

                <FormField label="Número judicial">
                  <Input
                    onChange={(event) => setForm((current) => ({ ...current, numero_judicial: event.target.value }))}
                    placeholder="0001234-56.2026.9.99.9999"
                    value={form.numero_judicial}
                  />
                </FormField>
              </>
            ) : null}

            <div className="md:col-span-2 rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(247,241,233,0.82))] px-5 py-4 shadow-[0_14px_32px_rgba(20,33,61,0.05)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950">Campos avançados</p>
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">prazo, pagamento e frequência</p>
                </div>
                {!isContinuous ? (
                  <Button onClick={() => setAdvancedOpen((current) => !current)} size="sm" type="button" variant="ghost">
                    {showAdvanced ? "Ocultar" : "Mostrar"}
                  </Button>
                ) : (
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Obrigatorio</span>
                )}
              </div>
              {showAdvanced ? <div className="mt-4 grid gap-4 md:grid-cols-2">
                <FormField label="Prazo inicial">
                  <Input onChange={(event) => setForm((current) => ({ ...current, prazo_inicial: event.target.value }))} type="date" value={form.prazo_inicial} />
                </FormField>

                <FormField label="Prazo intermediario">
                  <Input onChange={(event) => setForm((current) => ({ ...current, prazo_intermediario: event.target.value }))} type="date" value={form.prazo_intermediario} />
                </FormField>

                <FormField label={`Prazo final${requiresPrazo ? " *" : ""}`}>
                  <Input onChange={(event) => setForm((current) => ({ ...current, prazo_final: event.target.value }))} type="date" value={form.prazo_final} />
                </FormField>

                <FormField className="md:col-span-2" label="Frequência">
                  <select className={selectClassName} onChange={(event) => updateFrequencia(event.target.value)} value={form.frequencia}>
                    <option value="">Selecione a frequência</option>
                    <option value="Diaria">Diaria</option>
                    <option value="Semanal">Semanal</option>
                    <option value="Mensal">Mensal</option>
                    <option value="Eventual">Eventual</option>
                  </select>
                </FormField>

                {form.frequencia === "Semanal" ? (
                  <div className="md:col-span-2 grid gap-3">
                    <p className="text-sm font-medium text-slate-950">Dias da semana</p>
                    <div className="flex flex-wrap gap-2">
                      {WEEKDAY_OPTIONS.map((item) => (
                        <Button
                          className={form.frequencia_dias_semana.includes(item.label) ? "border-transparent bg-gradient-to-r from-blue-800 to-teal-600 text-white ring-0" : ""}
                          key={item.value}
                          onClick={() => toggleWeekday(item.label)}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          {item.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {form.frequencia === "Mensal" ? (
                  <FormField className="md:col-span-2" label="Dia do mês (1-31)">
                    <Input max="31" min="1" onChange={(event) => setForm((current) => ({ ...current, frequencia_dia_mes: event.target.value }))} type="number" value={form.frequencia_dia_mes} />
                  </FormField>
                ) : null}

                {frequenciaHint ? <p className="md:col-span-2 text-sm text-slate-500">{frequenciaHint}</p> : null}

                <label className="md:col-span-2 flex items-center justify-between rounded-[24px] border border-sky-100/90 bg-white/90 px-4 py-3 text-sm shadow-[0_10px_22px_rgba(20,33,61,0.04)]">
                  <div>
                    <p className="font-semibold text-slate-950">Envolve pagamento</p>
                    <p className="text-slate-500">Guarda o sinalizador operacional no metadata do caso.</p>
                  </div>
                  <input
                    checked={form.pagamento_envolvido}
                    className="h-5 w-5 accent-slate-950"
                    onChange={(event) => setForm((current) => ({ ...current, pagamento_envolvido: event.target.checked }))}
                    type="checkbox"
                  />
                </label>
              </div> : null}
            </div>

            {error ? (
              <div className="md:col-span-2 rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                {error} {conflictPreId ? <Link className="underline" to={`/pre-demandas/${conflictPreId}`}>Abrir processo existente</Link> : null}
              </div>
            ) : null}

            {showNumbers && !isSeiValid ? (
              <div className="md:col-span-2 rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                Informe um número SEI válido no formato <code>000181/26-02.227</code>.
              </div>
            ) : null}

            {result ? (
              <div className="md:col-span-2 rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                {result.idempotent ? "Processo existente localizado." : "Processo criado com sucesso."}{" "}
                <Link className="underline" to={`/pre-demandas/${result.preId}`}>
                  {result.preId}
                </Link>
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
