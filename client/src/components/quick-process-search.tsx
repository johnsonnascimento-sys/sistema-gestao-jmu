import { FormEvent, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { buildPreDemandaPath } from "../lib/pre-demanda-path";
import { Loader2, Search, User } from "lucide-react";
import { listPessoas, listPreDemandas } from "../lib/api";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import type { Pessoa } from "../types";

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
  const [personQuery, setPersonQuery] = useState("");
  const [personResults, setPersonResults] = useState<Pessoa[]>([]);
  const [personLoading, setPersonLoading] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<Pessoa | null>(null);
  const personDebounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (location.pathname === "/pre-demandas") {
      const params = new URLSearchParams(location.search);
      setQuery(params.get("q") ?? "");
      const pessoaId = params.get("pessoaId");
      const pessoaNome = params.get("pessoaNome");
      if (pessoaId) {
        setSelectedPerson(
          pessoaNome
            ? { id: pessoaId, nome: pessoaNome, createdAt: "", updatedAt: "", cargo: null, matricula: null, cpf: null, rg: null, pai: null, mae: null, endereco: null, dataNascimento: null }
            : { id: pessoaId, nome: "Pessoa selecionada", createdAt: "", updatedAt: "", cargo: null, matricula: null, cpf: null, rg: null, pai: null, mae: null, endereco: null, dataNascimento: null },
        );
        setPersonQuery(pessoaNome ?? "");
      } else {
        setSelectedPerson(null);
        setPersonQuery("");
      }
      return;
    }

    setQuery("");
    setPersonQuery("");
    setPersonResults([]);
    setSelectedPerson(null);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (personDebounceRef.current) {
      clearTimeout(personDebounceRef.current);
    }

    const trimmed = personQuery.trim();
    if (trimmed.length < 2 || selectedPerson) {
      setPersonResults([]);
      setPersonLoading(false);
      return;
    }

    setPersonLoading(true);
    personDebounceRef.current = setTimeout(async () => {
      try {
        const response = await listPessoas({ q: trimmed, page: 1, pageSize: 5 });
        setPersonResults(response.items);
      } catch {
        setPersonResults([]);
      } finally {
        setPersonLoading(false);
      }
    }, 250);

    return () => {
      if (personDebounceRef.current) {
        clearTimeout(personDebounceRef.current);
      }
    };
  }, [personQuery, selectedPerson]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextQuery = query.trim();
    if (!nextQuery && !selectedPerson) {
      return;
    }

    if (loading) {
      return;
    }

    setLoading(true);

    try {
      if (selectedPerson) {
        const searchParams = new URLSearchParams();
        if (nextQuery) {
          searchParams.set("q", nextQuery);
        }
        searchParams.set("pessoaId", selectedPerson.id);
        searchParams.set("pessoaNome", selectedPerson.nome);
        searchParams.set("view", "table");
        searchParams.set("page", "1");
        navigate(`/pre-demandas?${searchParams.toString()}`);
        return;
      }

      const response = await listPreDemandas({ q: nextQuery, pageSize: 8 });
      const exactMatch = response.items.find((item) => {
        const candidates = [
          item.preId,
          item.principalNumero,
          item.currentAssociation?.seiNumero,
          item.numeroJudicial,
        ].filter(Boolean) as string[];
        return candidates.some(
          (candidate) =>
            normalizeToken(candidate) === normalizeToken(nextQuery),
        );
      });
      const firstItem = response.items[0];

      if (exactMatch) {
        navigate(buildPreDemandaPath(exactMatch.preId));
        return;
      }

      if (response.items.length === 1 && firstItem) {
        navigate(buildPreDemandaPath(firstItem.preId));
        return;
      }

      navigate(
        `/pre-demandas?${new URLSearchParams({ q: nextQuery, view: "table", page: "1" }).toString()}`,
      );
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setQuery("");
    setPersonQuery("");
    setPersonResults([]);
    setSelectedPerson(null);

    if (location.pathname === "/pre-demandas") {
      navigate("/pre-demandas");
    }
  }

  return (
    <form
      className={cn(
        "w-full rounded-[28px] border p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl",
        variant === "sidebar"
          ? "rounded-[24px] border-white/10 bg-white/7 px-4 py-3.5 text-white shadow-[0_16px_32px_rgba(15,23,42,0.16)]"
          : "border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,244,237,0.88))]",
        className,
      )}
      onSubmit={handleSubmit}
    >
      <div className={cn("space-y-4", variant === "sidebar" && "space-y-3")}>
        <div>
          <p
            className={cn(
              "text-xs font-bold uppercase tracking-[0.32em]",
              variant === "sidebar" ? "text-indigo-200" : "text-slate-500",
            )}
          >
            Buscar
          </p>
        </div>

        <Input
          aria-label="Buscar processo rapido"
          className={cn(
            "h-12 rounded-[18px] px-4 text-[15px] font-medium",
            variant === "sidebar"
              ? "h-10 rounded-[16px] border-white/12 bg-white/9 text-white placeholder:text-indigo-200/70 focus:border-white/30 focus:ring-white/10"
              : "border-sky-100 bg-white text-slate-950 placeholder:text-slate-400",
          )}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="PROCESSO, SEI, pessoa ou assunto"
          value={query}
        />

        <div className="grid gap-2">
          <p className={cn("text-xs font-semibold uppercase tracking-[0.24em]", variant === "sidebar" ? "text-indigo-200/80" : "text-slate-500")}>Pessoa específica</p>
          <Input
            aria-label="Buscar pessoa especifica"
            className={cn(
              "h-12 rounded-[18px] px-4 text-[15px] font-medium",
              variant === "sidebar"
                ? "h-10 rounded-[16px] border-white/12 bg-white/9 text-white placeholder:text-indigo-200/70 focus:border-white/30 focus:ring-white/10"
                : "border-sky-100 bg-white text-slate-950 placeholder:text-slate-400",
            )}
            onChange={(event) => {
              const nextValue = event.target.value;
              setPersonQuery(nextValue);
              if (selectedPerson && nextValue.trim() !== selectedPerson.nome.trim()) {
                setSelectedPerson(null);
              }
            }}
            placeholder="Nome da pessoa"
            value={personQuery}
          />

          {selectedPerson ? (
            <div
              className={cn(
                "flex items-center justify-between gap-3 rounded-[18px] border px-4 py-3 text-sm",
                variant === "sidebar"
                  ? "border-white/10 bg-white/8 text-white"
                  : "border-sky-100 bg-white text-slate-700",
              )}
            >
              <div className="min-w-0">
                <p className="truncate font-semibold">{selectedPerson.nome}</p>
                <p className={cn("truncate text-xs", variant === "sidebar" ? "text-indigo-100/70" : "text-slate-500")}>
                  {selectedPerson.cargo ?? selectedPerson.matricula ?? selectedPerson.cpf ?? "Pessoa selecionada"}
                </p>
              </div>
              <button
                className={cn("shrink-0 text-sm font-medium transition", variant === "sidebar" ? "text-indigo-100/85 hover:text-white" : "text-slate-500 hover:text-slate-950")}
                onClick={() => {
                  setSelectedPerson(null);
                  setPersonQuery("");
                  setPersonResults([]);
                }}
                type="button"
              >
                Limpar pessoa
              </button>
            </div>
          ) : personLoading ? (
            <div className={cn("rounded-[18px] border px-4 py-3 text-sm", variant === "sidebar" ? "border-white/10 bg-white/8 text-indigo-100/80" : "border-sky-100 bg-white text-slate-500")}>
              Buscando pessoas...
            </div>
          ) : personResults.length > 0 ? (
            <div
              className={cn(
                "grid gap-2 rounded-[18px] border p-2",
                variant === "sidebar" ? "border-white/10 bg-white/8" : "border-sky-100 bg-white",
              )}
            >
              {personResults.map((person) => (
                <button
                  key={person.id}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-[14px] px-3 py-2 text-left text-sm transition",
                    variant === "sidebar"
                      ? "text-white hover:bg-white/10"
                      : "text-slate-700 hover:bg-slate-50",
                  )}
                  onClick={() => {
                    setSelectedPerson(person);
                    setPersonQuery(person.nome);
                    setPersonResults([]);
                  }}
                  type="button"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{person.nome}</p>
                    <p className={cn("truncate text-xs", variant === "sidebar" ? "text-indigo-100/70" : "text-slate-500")}>
                      {person.cargo ?? person.matricula ?? person.cpf ?? "Pessoa cadastrada"}
                    </p>
                  </div>
                  <User className={cn("h-4 w-4 shrink-0", variant === "sidebar" ? "text-indigo-100/70" : "text-slate-400")} />
                </button>
              ))}
            </div>
          ) : personQuery.trim().length >= 2 ? (
            <div className={cn("rounded-[18px] border px-4 py-3 text-sm", variant === "sidebar" ? "border-white/10 bg-white/8 text-indigo-100/80" : "border-sky-100 bg-white text-slate-500")}>
              Nenhuma pessoa encontrada.
            </div>
          ) : null}
        </div>

        <div
          className={cn(
            "flex items-center gap-4",
            variant === "sidebar" && "flex-col items-stretch gap-2.5",
          )}
        >
          <Button
            className="h-10 flex-1 rounded-[16px] bg-gradient-to-r from-indigo-700 via-indigo-600 to-violet-500 text-white shadow-[0_16px_30px_rgba(79,70,229,0.2)] hover:-translate-y-0.5"
            disabled={loading}
            type="submit"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Filtrar
          </Button>
          <button
            className={cn(
              "text-sm font-medium transition",
              variant === "sidebar"
                ? "text-indigo-100/80 hover:text-white"
                : "text-slate-600 hover:text-slate-950",
            )}
            onClick={handleClear}
            type="button"
          >
            Limpar busca
          </button>
        </div>
      </div>
    </form>
  );
}
