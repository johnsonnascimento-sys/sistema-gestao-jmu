import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Loader2, Search } from "lucide-react";
import { listPreDemandas } from "../lib/api";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

function normalizeToken(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function QuickProcessSearch({
  className,
  variant = "surface",
}: {
  className?: string;
  variant?: "surface" | "sidebar";
} = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (location.pathname === "/pre-demandas") {
      const params = new URLSearchParams(location.search);
      setQuery(params.get("q") ?? "");
      return;
    }

    setQuery("");
  }, [location.pathname, location.search]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextQuery = query.trim();
    if (!nextQuery || loading) {
      return;
    }

    setLoading(true);

    try {
      const response = await listPreDemandas({ q: nextQuery, pageSize: 8 });
      const exactMatch = response.items.find((item) => {
        const candidates = [item.preId, item.principalNumero, item.currentAssociation?.seiNumero, item.numeroJudicial].filter(Boolean) as string[];
        return candidates.some((candidate) => normalizeToken(candidate) === normalizeToken(nextQuery));
      });
      const firstItem = response.items[0];

      if (exactMatch) {
        navigate(`/pre-demandas/${exactMatch.preId}`);
        return;
      }

      if (response.items.length === 1 && firstItem) {
        navigate(`/pre-demandas/${firstItem.preId}`);
        return;
      }

      navigate(`/pre-demandas?${new URLSearchParams({ q: nextQuery, view: "table", page: "1" }).toString()}`);
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setQuery("");

    if (location.pathname === "/pre-demandas") {
      navigate("/pre-demandas");
    }
  }

  return (
    <form
      className={cn(
        "w-full rounded-[28px] border p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl",
        variant === "sidebar"
          ? "border-white/10 bg-white/8 text-white shadow-[0_20px_40px_rgba(15,23,42,0.18)]"
          : "border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,244,237,0.88))]",
        className,
      )}
      onSubmit={handleSubmit}
    >
      <div className="space-y-4">
        <div>
          <p className={cn("text-xs font-bold uppercase tracking-[0.32em]", variant === "sidebar" ? "text-indigo-200" : "text-slate-500")}>Buscar</p>
        </div>

        <Input
          aria-label="Buscar processo rapido"
          className={cn(
            "h-12 rounded-[18px] px-4 text-[15px] font-medium",
            variant === "sidebar"
              ? "border-white/15 bg-white/10 text-white placeholder:text-indigo-200/70 focus:border-white/35 focus:ring-white/10"
              : "border-sky-100 bg-white text-slate-950 placeholder:text-slate-400",
          )}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="PROCESSO, SEI, pessoa ou assunto"
          value={query}
        />

        <div className={cn("flex items-center gap-4", variant === "sidebar" && "flex-col items-stretch")}>
          <Button className="h-12 flex-1 rounded-[18px] bg-gradient-to-r from-indigo-700 via-indigo-600 to-violet-500 text-white shadow-[0_18px_38px_rgba(79,70,229,0.22)] hover:-translate-y-0.5" disabled={loading} type="submit">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Filtrar
          </Button>
          <button className={cn("text-sm font-medium transition", variant === "sidebar" ? "text-indigo-100/80 hover:text-white" : "text-slate-600 hover:text-slate-950")} onClick={handleClear} type="button">
            Limpar
          </button>
        </div>
      </div>
    </form>
  );
}
