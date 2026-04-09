import { useEffect, useState } from "react";
import { PageHeader } from "../components/page-header";
import { ErrorState, LoadingState } from "../components/states";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { listAdminAudit, formatAppError } from "../lib/api";
import type { GlobalAuditRecord } from "../types";
import { ArrowUpDown, Link, User, HelpCircle, History } from "lucide-react";
import { Link as RouterLink } from "react-router-dom";
import { buildPreDemandaPath } from "../lib/pre-demanda-path";

export function AdminAuditPage() {
  const [audit, setAudit] = useState<GlobalAuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterType, setFilterType] = useState<string>("all");

  async function load() {
    setLoading(true);
    try {
      const data = await listAdminAudit(100);
      setAudit(data);
    } catch (err) {
      setError(formatAppError(err, "Falha ao carregar auditoria."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function getIcon(type: string) {
    switch (type) {
      case "status":
        return <ArrowUpDown className="h-4 w-4 text-amber-500" />;
      case "sei":
        return <Link className="h-4 w-4 text-blue-500" />;
      case "user":
        return <User className="h-4 w-4 text-emerald-500" />;
      default:
        return <HelpCircle className="h-4 w-4 text-slate-400" />;
    }
  }

  function describeAudit(item: GlobalAuditRecord) {
    switch (item.type) {
      case "status":
        return `Alterou status de "${item.valorAnterior || "-"}" para "${item.valorNovo || "-"}".`;
      case "sei":
        return `Associou SEI: ${item.valorNovo || "Nenhum"} (Anterior: ${item.valorAnterior || "Nenhum"}).`;
      case "user":
        return `Alteração de usuário: ${item.motivo || "Ação administrativa"} (${item.valorAnterior || "-"} -> ${item.valorNovo || "-"})`;
      default:
        return "Alteração registada.";
    }
  }

  const filteredAudit =
    filterType === "all"
      ? audit
      : audit.filter((item) => item.type === filterType);

  if (loading)
    return (
      <LoadingState
        description="Carregando logs de auditoria"
        title="Auditoria"
      />
    );
  if (error) return <ErrorState description={error} />;

  return (
    <section className="grid gap-6">
      <PageHeader
        description="Rastreabilidade total de alterações de status, vinculações SEI e controle de acessos."
        eyebrow="Administração"
        title="Auditoria Global"
      />

      <div className="flex gap-2">
        <button
          onClick={() => setFilterType("all")}
          className={`px-4 py-2 rounded-xl text-sm font-medium ${filterType === "all" ? "bg-slate-900 text-white" : "bg-white border hover:bg-slate-50"}`}
        >
          Todos
        </button>
        <button
          onClick={() => setFilterType("status")}
          className={`px-4 py-2 rounded-xl text-sm font-medium ${filterType === "status" ? "bg-amber-100 text-amber-800" : "bg-white border hover:bg-slate-50"}`}
        >
          Status
        </button>
        <button
          onClick={() => setFilterType("sei")}
          className={`px-4 py-2 rounded-xl text-sm font-medium ${filterType === "sei" ? "bg-blue-100 text-blue-800" : "bg-white border hover:bg-slate-50"}`}
        >
          SEI
        </button>
        <button
          onClick={() => setFilterType("user")}
          className={`px-4 py-2 rounded-xl text-sm font-medium ${filterType === "user" ? "bg-emerald-100 text-emerald-800" : "bg-white border hover:bg-slate-50"}`}
        >
          Usuários
        </button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-slate-500" />
            <div>
              <CardTitle>Histórico de Operações</CardTitle>
              <CardDescription>
                Ultimas 100 alterações registradas no sistema.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-2">
          {filteredAudit.map((item) => (
            <article
              className="flex items-start gap-4 rounded-xl border border-slate-100 bg-white p-3 shadow-sm transition-all hover:bg-slate-50/50"
              key={`${item.type}-${item.id}`}
            >
              <div className="mt-1 rounded-lg bg-slate-100 p-2">
                {getIcon(item.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                  <span className="text-sm font-semibold text-slate-900">
                    {item.changedByName || "Sistema"}
                  </span>
                  <span className="text-xs text-slate-400">
                    {new Date(item.registradoEm).toLocaleString("pt-BR")}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-700">
                  {describeAudit(item)}
                </p>
                {item.motivo && item.type !== "user" && (
                  <p className="mt-1 text-xs text-slate-500">
                    Motivo: {item.motivo}
                  </p>
                )}
                {item.observacoes && (
                  <p className="mt-1 text-xs font-serif italic text-slate-400">
                    "{item.observacoes}"
                  </p>
                )}

                {item.type !== "user" && item.preId && (
                  <div className="mt-1">
                    <RouterLink
                      className="text-xs font-medium text-blue-600 hover:underline"
                      to={buildPreDemandaPath(item.preId)}
                    >
                      Ver processo
                    </RouterLink>
                  </div>
                )}
              </div>
            </article>
          ))}
          {filteredAudit.length === 0 && (
            <p className="text-sm text-slate-500 p-4">
              Nenhum registro encontrado para este filtro.
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
