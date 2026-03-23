import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { CalendarClock, ExternalLink } from "lucide-react";
import { PageHeader } from "../components/page-header";
import { EmptyState, ErrorState, LoadingState } from "../components/states";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { formatAppError, getDashboardSummary } from "../lib/api";
import { formatDateTimePtBr } from "../lib/date";
import type { PreDemandaDashboardSummary } from "../types";

function formatAudienciaSituacao(situacao: string) {
  if (situacao === "agendada") return "Agendada";
  if (situacao === "redesignada") return "Redesignada";
  if (situacao === "realizada") return "Realizada";
  if (situacao === "cancelada") return "Cancelada";
  if (situacao === "suspensa") return "Suspensa";
  return situacao;
}

export function AudienciasPautaPage() {
  const [summary, setSummary] = useState<PreDemandaDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  if (loading) {
    return <LoadingState description="Carregando pauta de audiencias..." title="Pauta de audiências" />;
  }

  if (error) {
    return <ErrorState description={error} />;
  }

  const audiencias = summary?.upcomingAudiencias ?? [];

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
              <Button asChild>
                <Link to="/pre-demandas">Abrir processos</Link>
              </Button>
            </div>
          }
          description="Central de consulta das audiências já designadas. A lista preserva a ordem cronológica de início para facilitar a conferência do dia."
          eyebrow="Agenda operacional"
          title="Pauta de audiências"
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
      >
        <Card className="overflow-hidden rounded-[32px] border-amber-200/70 bg-gradient-to-br from-amber-50/95 via-white/90 to-amber-100/60 shadow-xl">
          <CardHeader className="gap-3 pb-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="grid gap-1">
              <CardTitle className="text-xl font-light tracking-tight text-amber-950">Audiências designadas</CardTitle>
              <CardDescription className="text-amber-800/80">Acompanhe as audiências com início definido e abra o processo para ver os detalhes completos.</CardDescription>
            </div>
            <span className="inline-flex h-8 items-center rounded-full bg-amber-100 px-3 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-800 ring-1 ring-amber-200">
              {audiencias.length} {audiencias.length === 1 ? "audiência" : "audiências"}
            </span>
          </CardHeader>
          <CardContent className="max-h-[72vh] overflow-y-auto pr-2">
            {audiencias.length === 0 ? (
              <EmptyState
                title="Sem audiências futuras"
                description="Quando houver audiências agendadas ou redesignadas, elas aparecerão nesta pauta."
              />
            ) : (
              <div className="grid gap-3">
                {audiencias.map((audiencia) => (
                  <article
                    key={audiencia.id}
                    className="group relative grid gap-3 overflow-hidden rounded-[24px] border border-amber-200/80 bg-white/90 px-5 py-4 shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                  >
                    <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-amber-500 to-orange-400" />
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-700">{audiencia.preNumero}</p>
                        <h3 className="mt-2 break-words text-base font-semibold leading-snug text-slate-950">{audiencia.assunto}</h3>
                        <p className="mt-2 text-sm text-slate-600">
                          <CalendarClock className="mr-2 inline-block h-4 w-4 align-[-2px] text-amber-700" />
                          Início: {formatDateTimePtBr(audiencia.dataHoraInicio)}
                          {audiencia.sala ? ` • ${audiencia.sala}` : ""}
                        </p>
                      </div>
                      <div className="grid shrink-0 gap-2 justify-items-start lg:justify-items-end">
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-800 ring-1 ring-amber-200">
                          {formatAudienciaSituacao(audiencia.situacao)}
                        </span>
                        {audiencia.dataHoraFim ? (
                          <span className="rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600 ring-1 ring-slate-200">
                            Término previsto: {formatDateTimePtBr(audiencia.dataHoraFim)}
                          </span>
                        ) : (
                          <span className="rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 ring-1 ring-slate-200">
                            Sem fim definido
                          </span>
                        )}
                      </div>
                    </div>
                    {audiencia.descricao ? <p className="text-sm leading-6 text-slate-500">{audiencia.descricao}</p> : null}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Lista centrada na ordem de início da audiência</p>
                      <Button asChild size="sm" variant="outline" className="h-9 rounded-full border-amber-200 bg-white shadow-sm">
                        <Link to={`/pre-demandas/${audiencia.preId}`}>
                          Abrir processo
                          <ExternalLink className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
