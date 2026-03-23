import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ExternalLink, Search, X } from "lucide-react";
import { PageHeader } from "../components/page-header";
import { EmptyState, ErrorState, LoadingState } from "../components/states";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { formatAppError, getDashboardSummary } from "../lib/api";
import { formatDateOnlyPtBr, formatDateTimePtBr } from "../lib/date";
import type { PreDemandaDashboardSummary } from "../types";

function formatAudienciaSituacao(situacao: string) {
  if (situacao === "designada") return "Designada";
  if (situacao === "convertida_diligencia") return "Convertida em diligência";
  if (situacao === "nao_realizada") return "Não realizada";
  if (situacao === "realizada") return "Realizada";
  if (situacao === "cancelada") return "Cancelada";
  return situacao;
}

export function AudienciasPautaPage() {
  const [summary, setSummary] = useState<PreDemandaDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [magistradoQuery, setMagistradoQuery] = useState("");
  const [situacao, setSituacao] = useState("");

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
    return audiencias.filter((item) => {
      const startDate = item.dataHoraInicio.slice(0, 10);
      const normalizedMagistrado = (item.magistradoNome ?? "").toLocaleLowerCase("pt-BR");
      const normalizedQuery = magistradoQuery.trim().toLocaleLowerCase("pt-BR");

      if (dateFrom && startDate < dateFrom) {
        return false;
      }

      if (dateTo && startDate > dateTo) {
        return false;
      }

      if (situacao && item.situacao !== situacao) {
        return false;
      }

      if (normalizedQuery && !normalizedMagistrado.includes(normalizedQuery)) {
        return false;
      }

      return true;
    });
  }, [audiencias, dateFrom, dateTo, magistradoQuery, situacao]);

  function handleClearFilters() {
    setDateFrom("");
    setDateTo("");
    setMagistradoQuery("");
    setSituacao("");
  }

  if (loading) {
    return <LoadingState description="Carregando pauta de audiencias..." title="Pauta de audiências" />;
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
          description="Consulta de audiências em formato de pauta, priorizando processo, magistrado, data/hora de início, situação e observação."
          eyebrow="Agenda judicial"
          title="Pauta de audiências"
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.08, ease: "easeOut" }}
      >
        <Card className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
          <CardContent className="grid gap-5 p-4 md:p-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[220px_220px_minmax(260px,1fr)_260px_auto_auto]">
              <label className="grid gap-2 text-sm">
                <span className="font-medium text-slate-700">Data Início</span>
                <Input onChange={(event) => setDateFrom(event.target.value)} type="date" value={dateFrom} />
              </label>
              <label className="grid gap-2 text-sm">
                <span className="font-medium text-slate-700">Data Fim</span>
                <Input onChange={(event) => setDateTo(event.target.value)} type="date" value={dateTo} />
              </label>
              <label className="grid gap-2 text-sm">
                <span className="font-medium text-slate-700">Magistrado</span>
                <Input onChange={(event) => setMagistradoQuery(event.target.value)} placeholder="Pesquisar..." value={magistradoQuery} />
              </label>
              <label className="grid gap-2 text-sm">
                <span className="font-medium text-slate-700">Situação</span>
                <select
                  className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  onChange={(event) => setSituacao(event.target.value)}
                  value={situacao}
                >
                  <option value="">Nada selecionado</option>
                  <option value="designada">Designada</option>
                  <option value="convertida_diligencia">Convertida em diligência</option>
                  <option value="nao_realizada">Não realizada</option>
                  <option value="realizada">Realizada</option>
                  <option value="cancelada">Cancelada</option>
                </select>
              </label>
              <div className="flex items-end">
                <Button className="w-full md:w-auto" type="button" variant="default">
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

            <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-2">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Audiências</h2>
                <p className="text-sm text-slate-500">
                  {filteredAudiencias.length} registro{filteredAudiencias.length === 1 ? "" : "s"} encontrado{filteredAudiencias.length === 1 ? "" : "s"}.
                </p>
              </div>
            </div>

            {filteredAudiencias.length === 0 ? (
              <EmptyState
                title="Sem audiências na pauta"
                description="Nenhum processo ativo com audiência cadastrada corresponde aos filtros atuais."
              />
            ) : (
              <div className="overflow-hidden rounded-[20px] border border-slate-200">
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse text-sm">
                    <thead className="bg-slate-100/90 text-left text-slate-700">
                      <tr>
                        <th className="border-b border-slate-200 px-4 py-3 font-semibold">Processo</th>
                        <th className="border-b border-slate-200 px-4 py-3 font-semibold">Magistrado</th>
                        <th className="border-b border-slate-200 px-4 py-3 font-semibold">Data/hora Início</th>
                        <th className="border-b border-slate-200 px-4 py-3 font-semibold">Situação</th>
                        <th className="border-b border-slate-200 px-4 py-3 font-semibold">Observação</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {filteredAudiencias.map((audiencia) => (
                        <tr className="align-top transition-colors hover:bg-slate-50" key={audiencia.id}>
                          <td className="border-b border-slate-100 px-4 py-4">
                            <div className="grid gap-2">
                              <Link className="w-fit text-base font-semibold text-sky-700 hover:underline" to={`/pre-demandas/${audiencia.preId}`}>
                                {audiencia.preNumero}
                              </Link>
                              <p className="max-w-[360px] text-sm leading-6 text-slate-700">{audiencia.assunto}</p>
                            </div>
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4">
                            <p className="min-w-[220px] text-sm leading-6 text-slate-700">{audiencia.magistradoNome ?? "Não identificado"}</p>
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4">
                            <div className="grid gap-1 text-sm text-slate-700">
                              <span className="font-medium">{formatDateTimePtBr(audiencia.dataHoraInicio)}</span>
                              <span className="text-xs text-slate-500">{formatDateOnlyPtBr(audiencia.dataHoraInicio.slice(0, 10))}</span>
                            </div>
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4">
                            <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-700 ring-1 ring-slate-200">
                              {formatAudienciaSituacao(audiencia.situacao)}
                            </span>
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4">
                            <div className="grid gap-2">
                              <p className="max-w-[420px] text-sm leading-6 text-slate-700">{audiencia.observacoes ?? audiencia.descricao ?? "Sem observação registrada."}</p>
                              <Button asChild className="w-fit" size="sm" variant="outline">
                                <Link to={`/pre-demandas/${audiencia.preId}`}>
                                  Abrir processo
                                  <ExternalLink className="ml-2 h-4 w-4" />
                                </Link>
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
