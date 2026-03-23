import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, X } from "lucide-react";
import { PageHeader } from "../components/page-header";
import { EmptyState, ErrorState, LoadingState } from "../components/states";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { formatAppError, getDashboardSummary } from "../lib/api";
import { formatDateTimePtBr } from "../lib/date";
import type { PreDemandaDashboardSummary } from "../types";

type PautaFilters = {
  processo: string;
  magistrado: string;
  situacao: string;
  dataInicio: string;
  dataFim: string;
};

const EMPTY_FILTERS: PautaFilters = {
  processo: "",
  magistrado: "",
  situacao: "",
  dataInicio: "",
  dataFim: "",
};

function normalizeText(value: string) {
  return value.trim().toLocaleLowerCase("pt-BR");
}

function formatAudienciaSituacao(situacao: string) {
  if (situacao === "designada") return "Designada";
  if (situacao === "convertida_diligencia") return "Convertida em diligencia";
  if (situacao === "nao_realizada") return "Nao realizada";
  if (situacao === "realizada") return "Realizada";
  if (situacao === "cancelada") return "Cancelada";
  return situacao;
}

function getSituacaoTone(situacao: string) {
  if (situacao === "designada") return "bg-sky-50 text-sky-700 ring-1 ring-sky-200";
  if (situacao === "convertida_diligencia") return "bg-amber-50 text-amber-800 ring-1 ring-amber-200";
  if (situacao === "nao_realizada") return "bg-rose-50 text-rose-700 ring-1 ring-rose-200";
  if (situacao === "realizada") return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
}

export function AudienciasPautaPage() {
  const [summary, setSummary] = useState<PreDemandaDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draftFilters, setDraftFilters] = useState<PautaFilters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<PautaFilters>(EMPTY_FILTERS);

  async function loadSummary() {
    try {
      setSummary(await getDashboardSummary());
    } catch (nextError) {
      setError(formatAppError(nextError, "Falha ao carregar pauta de audiencias."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSummary();
  }, []);

  useEffect(() => {
    const handleUpdate = () => {
      void loadSummary();
    };

    window.addEventListener("pre-demanda-updated", handleUpdate);
    return () => window.removeEventListener("pre-demanda-updated", handleUpdate);
  }, []);

  const audiencias = summary?.upcomingAudiencias ?? [];

  const filteredAudiencias = useMemo(() => {
    const processoQuery = normalizeText(appliedFilters.processo);
    const magistradoQuery = normalizeText(appliedFilters.magistrado);

    return [...audiencias]
      .filter((item) => {
        const startDate = item.dataHoraInicio.slice(0, 10);
        const searchableProcesso = normalizeText(`${item.preNumero} ${item.preId}`);
        const searchableMagistrado = normalizeText(item.magistradoNome ?? "");

        if (appliedFilters.dataInicio && startDate < appliedFilters.dataInicio) {
          return false;
        }

        if (appliedFilters.dataFim && startDate > appliedFilters.dataFim) {
          return false;
        }

        if (appliedFilters.situacao && item.situacao !== appliedFilters.situacao) {
          return false;
        }

        if (processoQuery && !searchableProcesso.includes(processoQuery)) {
          return false;
        }

        if (magistradoQuery && !searchableMagistrado.includes(magistradoQuery)) {
          return false;
        }

        return true;
      })
      .sort((left, right) => new Date(left.dataHoraInicio).getTime() - new Date(right.dataHoraInicio).getTime());
  }, [appliedFilters, audiencias]);

  function handleConsultar() {
    setAppliedFilters(draftFilters);
  }

  function handleClearFilters() {
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
  }

  if (loading) {
    return <LoadingState description="Carregando pauta de audiencias..." title="Pauta de audiencias" />;
  }

  if (error) {
    return <ErrorState description={error} />;
  }

  return (
    <div className="grid gap-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <PageHeader
          actions={
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="secondary">
                <Link to="/dashboard">Voltar ao dashboard</Link>
              </Button>
            </div>
          }
          description="Consulta de audiencias em formato de pauta, com filtros compactos e listagem principal em tabela."
          eyebrow="Agenda judicial"
          title="Pauta de audiencias"
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.08, ease: "easeOut" }}
      >
        <Card className="overflow-hidden rounded-[24px] border-slate-200 bg-white shadow-sm">
          <CardHeader className="gap-1 border-b border-slate-100 pb-4">
            <CardTitle className="text-lg font-semibold text-slate-900">Filtros</CardTitle>
            <CardDescription className="text-slate-500">
              O formato segue a pauta do e-Proc: processo, magistrado, situacao e periodo.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 p-4 md:p-5">
            <div className="grid gap-4 xl:grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)_220px_minmax(260px,1fr)_auto_auto]">
              <label className="grid gap-2 text-sm">
                <span className="font-medium text-slate-700">Processo</span>
                <Input
                  onChange={(event) => setDraftFilters((current) => ({ ...current, processo: event.target.value }))}
                  placeholder="Numero ou identificador"
                  value={draftFilters.processo}
                />
              </label>
              <label className="grid gap-2 text-sm">
                <span className="font-medium text-slate-700">Magistrado</span>
                <Input
                  onChange={(event) => setDraftFilters((current) => ({ ...current, magistrado: event.target.value }))}
                  placeholder="Pesquisar..."
                  value={draftFilters.magistrado}
                />
              </label>
              <label className="grid gap-2 text-sm">
                <span className="font-medium text-slate-700">Situacao</span>
                <select
                  className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  onChange={(event) => setDraftFilters((current) => ({ ...current, situacao: event.target.value }))}
                  value={draftFilters.situacao}
                >
                  <option value="">Nada selecionado</option>
                  <option value="designada">Designada</option>
                  <option value="convertida_diligencia">Convertida em diligencia</option>
                  <option value="nao_realizada">Nao realizada</option>
                  <option value="realizada">Realizada</option>
                  <option value="cancelada">Cancelada</option>
                </select>
              </label>
              <div className="grid gap-2 text-sm">
                <span className="font-medium text-slate-700">Data inicio/fim</span>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    onChange={(event) => setDraftFilters((current) => ({ ...current, dataInicio: event.target.value }))}
                    type="date"
                    value={draftFilters.dataInicio}
                  />
                  <Input
                    onChange={(event) => setDraftFilters((current) => ({ ...current, dataFim: event.target.value }))}
                    type="date"
                    value={draftFilters.dataFim}
                  />
                </div>
              </div>
              <div className="flex items-end">
                <Button className="w-full md:w-auto" onClick={handleConsultar} type="button" variant="default">
                  <Search className="h-4 w-4" />
                  Consultar
                </Button>
              </div>
              <div className="flex items-end">
                <Button className="w-full md:w-auto" onClick={handleClearFilters} type="button" variant="outline">
                  <X className="h-4 w-4" />
                  Limpar
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
              <p className="text-sm text-slate-500">
                {filteredAudiencias.length} registro{filteredAudiencias.length === 1 ? "" : "s"} encontrado{filteredAudiencias.length === 1 ? "" : "s"}.
              </p>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                Magistrado aparece quando o payload o informar.
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.14, ease: "easeOut" }}
      >
        <Card className="overflow-hidden rounded-[24px] border-slate-200 bg-white shadow-sm">
          <CardHeader className="border-b border-slate-100 pb-4">
            <CardTitle className="text-xl font-semibold tracking-tight text-slate-900">Audiencias</CardTitle>
            <CardDescription className="text-slate-500">Lista principal com visualizacao compacta para consulta rapida.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {filteredAudiencias.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  title="Sem audiencias na pauta"
                  description="Nenhum processo ativo com audiencia cadastrada corresponde aos filtros atuais."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-100/95 text-left text-slate-700 backdrop-blur">
                    <tr>
                      <th className="border-b border-slate-200 px-4 py-3 font-semibold">Processo</th>
                      <th className="border-b border-slate-200 px-4 py-3 font-semibold">Magistrado</th>
                      <th className="border-b border-slate-200 px-4 py-3 font-semibold">Data/hora inicio</th>
                      <th className="border-b border-slate-200 px-4 py-3 font-semibold">Situacao</th>
                      <th className="border-b border-slate-200 px-4 py-3 font-semibold">Observacao</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {filteredAudiencias.map((audiencia) => (
                      <tr className="align-top transition-colors hover:bg-slate-50" key={audiencia.id}>
                        <td className="border-b border-slate-100 px-4 py-4">
                          <Link className="w-fit text-base font-semibold text-sky-700 hover:underline" to={`/pre-demandas/${audiencia.preId}`}>
                            {audiencia.preNumero}
                          </Link>
                        </td>
                        <td className="border-b border-slate-100 px-4 py-4">
                          <p className="min-w-[220px] text-sm leading-6 text-slate-700">{audiencia.magistradoNome ?? "-"}</p>
                        </td>
                        <td className="border-b border-slate-100 px-4 py-4">
                          <p className="whitespace-nowrap text-sm font-medium text-slate-700">{formatDateTimePtBr(audiencia.dataHoraInicio)}</p>
                        </td>
                        <td className="border-b border-slate-100 px-4 py-4">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${getSituacaoTone(audiencia.situacao)}`}>
                            {formatAudienciaSituacao(audiencia.situacao)}
                          </span>
                        </td>
                        <td className="border-b border-slate-100 px-4 py-4">
                          <p className="max-w-[460px] text-sm leading-6 text-slate-700">{audiencia.observacoes ?? audiencia.descricao ?? "-"}</p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
