import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { buildPreDemandaPath } from "../lib/pre-demanda-path";
import { Search, FileText, Calendar, ArrowRight, Loader2 } from "lucide-react";
import { listPreDemandas } from "../lib/api";
import { formatDateOnlyPtBr } from "../lib/date";
import type { PreDemanda } from "../types";
import { Dialog, DialogContent } from "./ui/dialog";
import { cn } from "../lib/utils";

export function SpotlightSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PreDemanda[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Atalho global Ctrl+K ou Cmd+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Resetar estado ao fechar
  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
    }
  }, [open]);

  // Busca debounced
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const response = await listPreDemandas({ q: query, pageSize: 6 });
        setResults(response.items);
        setSelectedIndex(0);
      } catch (error) {
        console.error("Erro na busca spotlight:", error);
      } finally {
        setLoading(false);
      }
    }, 250); // 250ms debounce

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Navegação por teclado
  useEffect(() => {
    if (!open || results.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % results.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(
          (prev) => (prev - 1 + results.length) % results.length,
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        const selected = results[selectedIndex];
        if (selected) {
          handleSelect(selected);
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, results, selectedIndex]);

  const handleSelect = (item: PreDemanda) => {
    setOpen(false);
    navigate(buildPreDemandaPath(item.preId));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "em_andamento":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "aguardando_sei":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "encerrada":
        return "bg-slate-100 text-slate-800 border-slate-200";
      default:
        return "bg-slate-100 text-slate-800 border-slate-200";
    }
  };

  const translateStatus = (status: string) => {
    switch (status) {
      case "em_andamento":
        return "Em Andamento";
      case "aguardando_sei":
        return "Aguardando SEI";
      case "encerrada":
        return "Encerrada";
      default:
        return status;
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="p-0 overflow-hidden w-[540px] max-w-full backdrop-blur-2xl bg-white/92 border border-white/20 shadow-[0_40px_120px_rgba(15,23,42,0.3)]">
        <div className="flex items-center gap-3 border-b border-slate-200/60 px-5 py-4">
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          ) : (
            <Search className="h-5 w-5 text-slate-400" />
          )}
          <input
            autoFocus
            className="flex-1 bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400 selection:bg-rose-100"
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Busque por assunto, SEI, solicitante, ID..."
            type="text"
            value={query}
          />
        </div>

        <div className="max-h-[380px] overflow-y-auto py-2">
          {query.trim() === "" ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Search className="h-10 w-10 opacity-20" />
              <p className="mt-3 text-sm">
                Digite para pesquisar em todo o sistema...
              </p>
              <p className="mt-1 text-xs opacity-75">
                Busque por Assunto, CPF, SEI ou ID
              </p>
            </div>
          ) : results.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <FileText className="h-10 w-10 opacity-20" />
              <p className="mt-3 text-sm">
                Nenhum processo encontrado para "{query}"
              </p>
            </div>
          ) : (
            <div className="px-2">
              {results.map((item, index) => (
                <button
                  key={item.id}
                  className={cn(
                    "flex w-full items-center justify-between gap-4 rounded-2xl px-4 py-3 text-left transition-all duration-150 animate-in fade-in-50",
                    index === selectedIndex
                      ? "bg-slate-900 text-white shadow-lg shadow-slate-900/10"
                      : "hover:bg-slate-50 text-slate-700",
                  )}
                  onClick={() => handleSelect(item)}
                  type="button"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p
                        className={cn(
                          "text-sm font-semibold truncate",
                          index === selectedIndex
                            ? "text-white"
                            : "text-slate-900",
                        )}
                      >
                        {item.assunto}
                      </p>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-medium border",
                          index === selectedIndex
                            ? "bg-white/10 text-white border-white/20"
                            : getStatusColor(item.status),
                        )}
                      >
                        {translateStatus(item.status)}
                      </span>
                    </div>
                    <div
                      className={cn(
                        "mt-1 flex items-center gap-3 text-xs",
                        index === selectedIndex
                          ? "text-slate-200"
                          : "text-slate-500",
                      )}
                    >
                      {item.currentAssociation?.seiNumero ? (
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {item.currentAssociation.seiNumero}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 opacity-75">
                          ID: {item.preId}
                        </span>
                      )}
                      {item.prazoProcesso && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDateOnlyPtBr(item.prazoProcesso)}
                        </span>
                      )}
                    </div>
                  </div>
                  <ArrowRight
                    className={cn(
                      "h-4 w-4 shrink-0 transition-transform",
                      index === selectedIndex
                        ? "translate-x-1 text-white"
                        : "text-slate-300",
                    )}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {results.length > 0 && (
          <div className="border-t border-slate-200/60 bg-slate-50/80 px-4 py-2.5 text-[11px] text-slate-400 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="bg-white border select-none rounded px-1 shadow-sm font-mono">
                ↑↓
              </span>{" "}
              Navegar
              <span className="bg-white border select-none rounded px-1 shadow-sm font-mono mt-0.5">
                Enter
              </span>{" "}
              Selecionar
            </div>
            <div>
              <span className="bg-white border select-none rounded px-1 shadow-sm font-mono">
                Esc
              </span>{" "}
              Fechar
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
