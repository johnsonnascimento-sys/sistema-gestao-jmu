import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Loader2, Send, XCircle } from "lucide-react";
import { PageHeader } from "../components/page-header";
import { EmptyState } from "../components/states";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { FormField } from "../components/form-field";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { addPreDemandaAndamentosLote, formatAppError, listPreDemandas } from "../lib/api";
import { formatDateOnlyPtBr } from "../lib/date";
import { buildPreDemandaPath } from "../lib/pre-demanda-path";
import { getPreDemandaStatusLabel } from "../lib/pre-demanda-status";
import { toIsoFromDateTimeLocal } from "./pre-demanda-detail-types";
import type { BulkAndamentoResult, PreDemanda } from "../types";

const SEARCH_PAGE_SIZE = 8;

function ProcessSummaryCard({
  item,
  selected,
  onToggle,
}: {
  item: PreDemanda;
  selected: boolean;
  onToggle: (item: PreDemanda) => void;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white/95 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <label className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            <input checked={selected} onChange={() => onToggle(item)} type="checkbox" />
            Selecionado
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-slate-950">{item.assunto}</p>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700">
              {getPreDemandaStatusLabel(item.status)}
            </span>
          </div>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
            {item.principalNumero}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {item.currentAssociation?.seiNumero ? `SEI ${item.currentAssociation.seiNumero} • ` : ""}
            {item.pessoaPrincipal?.nome ?? item.solicitante}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span>ID {item.preId}</span>
            <span>Prazo {formatDateOnlyPtBr(item.prazoProcesso, "Nao definido")}</span>
            <Link className="font-semibold text-sky-700 hover:text-sky-900" to={buildPreDemandaPath(item.preId)}>
              Abrir processo
            </Link>
          </div>
        </div>
        <Button onClick={() => onToggle(item)} type="button" variant={selected ? "secondary" : "outline"}>
          {selected ? "Remover" : "Adicionar"}
        </Button>
      </div>
    </div>
  );
}

export function AndamentosLotePage() {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [results, setResults] = useState<PreDemanda[]>([]);
  const [selectedItems, setSelectedItems] = useState<PreDemanda[]>([]);
  const [form, setForm] = useState({ data_hora: "", descricao: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [lastResult, setLastResult] = useState<BulkAndamentoResult | null>(null);

  const selectedIds = useMemo(
    () => new Set(selectedItems.map((item) => item.preId)),
    [selectedItems],
  );
  const addableResults = useMemo(
    () => results.filter((item) => !selectedIds.has(item.preId)),
    [results, selectedIds],
  );

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setSearchError("");
      setSearching(false);
      return;
    }

    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await listPreDemandas({ q: trimmed, pageSize: SEARCH_PAGE_SIZE, page: 1 });
        setResults(response.items);
        setSearchError("");
      } catch (error) {
        setResults([]);
        setSearchError(formatAppError(error, "Falha ao buscar processos."));
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [query]);

  function toggleSelected(item: PreDemanda) {
    setSelectedItems((current) =>
      current.some((entry) => entry.preId === item.preId)
        ? current.filter((entry) => entry.preId !== item.preId)
        : [...current, item],
    );
  }

  function addAllResults() {
    if (!addableResults.length) {
      return;
    }
    setSelectedItems((current) => [...current, ...addableResults]);
  }

  async function handleSubmit() {
    if (submitting || form.descricao.trim().length < 3 || selectedItems.length === 0) {
      return;
    }

    setSubmitting(true);
    setSubmitError("");
    try {
      const result = await addPreDemandaAndamentosLote({
        pre_ids: selectedItems.map((item) => item.preId),
        descricao: form.descricao.trim(),
        data_hora: form.data_hora ? toIsoFromDateTimeLocal(form.data_hora) : null,
      });
      setLastResult(result);
      const failedIds = new Set(
        result.results.filter((item) => !item.ok).map((item) => item.preId),
      );
      setSelectedItems((current) => current.filter((item) => failedIds.has(item.preId)));
    } catch (error) {
      setSubmitError(formatAppError(error, "Falha ao registrar andamentos em lote."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="grid gap-6">
      <PageHeader
        eyebrow="Operacao em lote"
        title="Andamentos em Lote"
        description="Busque processos por qualquer termo, monte sua selecao e lance o mesmo andamento manual em todos de uma vez."
      />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Buscar e selecionar processos</CardTitle>
            <CardDescription>
              Pesquise por processo, SEI, pessoa ou assunto. Voce pode acumular itens de varias buscas antes de enviar.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex flex-col gap-3 md:flex-row">
              <Input
                className="flex-1"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="PROCESSO, SEI, pessoa ou assunto"
                value={query}
              />
              <Button disabled={!addableResults.length} onClick={addAllResults} type="button" variant="outline">
                Selecionar resultados
              </Button>
            </div>

            {searchError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {searchError}
              </div>
            ) : null}

            {!query.trim() ? (
              <EmptyState
                title="Digite para buscar"
                description="Use a mesma logica da busca global para localizar processos por numero, SEI, solicitante, pessoa ou assunto."
              />
            ) : searching ? (
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                Buscando processos...
              </div>
            ) : results.length ? (
              <div className="grid gap-3">
                {results.map((item) => (
                  <ProcessSummaryCard
                    item={item}
                    key={item.preId}
                    onToggle={toggleSelected}
                    selected={selectedIds.has(item.preId)}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                title="Nenhum processo encontrado"
                description={`Nenhum processo corresponde a "${query.trim()}".`}
              />
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Selecionados</CardTitle>
              <CardDescription>
                {selectedItems.length} processo(s) pronto(s) para receber o mesmo andamento.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-800">
                  {selectedItems.length} selecionado(s)
                </span>
                <Button
                  disabled={!selectedItems.length}
                  onClick={() => setSelectedItems([])}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  Remover todos
                </Button>
              </div>

              {selectedItems.length ? (
                <div className="grid gap-3">
                  {selectedItems.map((item) => (
                    <div className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3" key={item.preId}>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-950">{item.assunto}</p>
                        <p className="mt-1 text-sm text-slate-500">{item.principalNumero}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                          <span>{item.preId}</span>
                          <Link className="font-semibold text-sky-700 hover:text-sky-900" to={buildPreDemandaPath(item.preId)}>
                            Abrir
                          </Link>
                        </div>
                      </div>
                      <Button onClick={() => toggleSelected(item)} size="sm" type="button" variant="ghost">
                        Remover
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                  Nenhum processo selecionado ainda.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Lancar andamento</CardTitle>
              <CardDescription>
                O mesmo texto e data/hora serao gravados como andamento manual em todos os processos selecionados.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <FormField label="Data e hora">
                <Input
                  onChange={(event) => setForm((current) => ({ ...current, data_hora: event.target.value }))}
                  type="datetime-local"
                  value={form.data_hora}
                />
              </FormField>
              <FormField label="Descricao">
                <Textarea
                  onChange={(event) => setForm((current) => ({ ...current, descricao: event.target.value }))}
                  rows={6}
                  value={form.descricao}
                />
              </FormField>
              {submitError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {submitError}
                </div>
              ) : null}
              <Button
                disabled={submitting || form.descricao.trim().length < 3 || selectedItems.length === 0}
                onClick={handleSubmit}
                type="button"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Lancar andamento em lote
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {lastResult ? (
        <Card>
          <CardHeader>
            <CardTitle>Resultado do lançamento</CardTitle>
            <CardDescription>
              {lastResult.successCount} sucesso(s) e {lastResult.failureCount} falha(s) em {lastResult.total} processo(s).
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800">
                <CheckCircle2 className="h-4 w-4" />
                {lastResult.successCount} sucesso(s)
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-rose-100 px-3 py-1 text-sm font-semibold text-rose-800">
                <XCircle className="h-4 w-4" />
                {lastResult.failureCount} falha(s)
              </span>
            </div>
            <div className="grid gap-3">
              {lastResult.results.map((item) => (
                <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4" key={`${item.preId}-${item.ok ? "ok" : "error"}`}>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-950">{item.preId}</p>
                    <p className={`mt-1 text-sm ${item.ok ? "text-emerald-700" : "text-rose-700"}`}>
                      {item.message ?? (item.ok ? "Andamento registrado." : "Falha ao registrar andamento.")}
                    </p>
                  </div>
                  <Link className="text-sm font-semibold text-sky-700 hover:text-sky-900" to={buildPreDemandaPath(item.preId)}>
                    Abrir processo
                  </Link>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
