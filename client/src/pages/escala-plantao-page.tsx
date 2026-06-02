import { useEffect, useState, type FormEvent } from "react";
import { Search, ShieldCheck, Users, Building2, RefreshCw } from "lucide-react";
import { PageHeader } from "../components/page-header";
import { EmptyState, ErrorState, LoadingState } from "../components/states";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { listEscalaPlantaoDados, formatAppError, type EscalaPlantaoData } from "../lib/api";

function DataPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[22px] border border-white/70 bg-white/85 px-4 py-3 shadow-[0_12px_32px_rgba(15,23,42,0.06)]">
      <p className="text-[11px] font-bold uppercase tracking-[0.26em] text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function PublicListItem({
  title,
  subtitle,
  meta,
}: {
  title: string;
  subtitle?: string | null;
  meta: string;
}) {
  return (
    <li className="rounded-[20px] border border-slate-200/80 bg-gradient-to-br from-white/95 to-slate-50/80 px-4 py-3 shadow-sm">
      <div className="flex flex-col gap-1">
        <p className="font-semibold text-slate-950">{title}</p>
        {subtitle ? <p className="text-sm text-slate-600">{subtitle}</p> : null}
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">{meta}</p>
      </div>
    </li>
  );
}

export function EscalaPlantaoPage() {
  const [inputValue, setInputValue] = useState("");
  const [query, setQuery] = useState("");
  const [data, setData] = useState<EscalaPlantaoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        setLoading(true);
        setError("");
        const nextData = await listEscalaPlantaoDados(query);

        if (active) {
          setData(nextData);
        }
      } catch (nextError) {
        if (active) {
          setError(formatAppError(nextError, "Falha ao carregar a escala de plantão."));
          setData(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      active = false;
    };
  }, [query]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuery(inputValue.trim());
  }

  function handleClear() {
    setInputValue("");
    setQuery("");
  }

  if (loading && !data) {
    return (
      <section className="grid gap-6">
        <PageHeader
          eyebrow="Acesso público"
          title="Escala de Plantão"
          description="Consulta pública dos dados necessários para a escala, sem exigir login no Gestor JMU."
        />
        <LoadingState description="Carregando a consulta pública da escala." />
      </section>
    );
  }

  if (error && !data) {
    return <ErrorState description={error} />;
  }

  const pessoas = data?.pessoas ?? [];
  const setores = data?.setores ?? [];

  return (
    <div className="grid gap-6 animate-in fade-in duration-300">
      <PageHeader
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary" className="rounded-full bg-white">
              <a href="/login">Entrar no Gestor</a>
            </Button>
            <Button
              onClick={handleClear}
              type="button"
              variant="outline"
              className="rounded-full bg-white"
            >
              <RefreshCw className="h-4 w-4" />
              Limpar filtro
            </Button>
          </div>
        }
        eyebrow="Acesso público"
        title="Escala de Plantão"
        description="Consulta pública dos recortes liberados pelo Gestor JMU. O acesso é aberto, mas a escrita permanece restrita ao sistema interno."
      />

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-[32px] border-white/70 bg-white/55 backdrop-blur-xl shadow-xl">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-xl font-light tracking-tight text-slate-800">
              <ShieldCheck className="h-5 w-5 text-sky-600" />
              Consulta pública
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <DataPill label="Pessoas" value={pessoas.length} />
              <DataPill label="Setores" value={setores.length} />
            </div>
            <form className="grid gap-3 sm:grid-cols-[1fr_auto_auto]" onSubmit={handleSubmit}>
              <label className="sm:col-span-3">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Buscar pessoa ou setor
                </span>
                <Input
                  autoComplete="off"
                  placeholder="Ex.: Maria, DIPES, Estagiário..."
                  value={inputValue}
                  onChange={(event) => setInputValue(event.target.value)}
                />
              </label>
              <Button className="rounded-full" type="submit">
                <Search className="h-4 w-4" />
                Filtrar
              </Button>
            </form>
            <div className="rounded-[24px] border border-sky-100 bg-sky-50/70 px-4 py-3 text-sm text-slate-600">
              A consulta abaixo usa somente os campos públicos necessários para
              a escala. Campos sensíveis como CPF, RG e endereço não são
              expostos.
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[32px] border-white/70 bg-white/55 backdrop-blur-xl shadow-xl">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-xl font-light tracking-tight text-slate-800">
              <Building2 className="h-5 w-5 text-indigo-600" />
              Setores visíveis
            </CardTitle>
          </CardHeader>
          <CardContent>
            {setores.length === 0 ? (
              <EmptyState
                description="Nenhum setor disponível para exibição pública no momento."
                title="Sem setores"
              />
            ) : (
              <ul className="grid gap-3">
                {setores.slice(0, 8).map((setor) => (
                  <PublicListItem
                    key={setor.id}
                    meta={setor.id}
                    subtitle={setor.nomeCompleto}
                    title={setor.sigla}
                  />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <Card className="rounded-[32px] border-white/70 bg-white/55 backdrop-blur-xl shadow-xl">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-xl font-light tracking-tight text-slate-800">
            <Users className="h-5 w-5 text-emerald-600" />
            Pessoas para plantão
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingState description="Atualizando os resultados da consulta pública." />
          ) : pessoas.length === 0 ? (
            <EmptyState
              description="Nenhuma pessoa encontrada com o filtro informado."
              title="Sem resultados"
            />
          ) : (
            <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {pessoas.map((pessoa) => (
                <PublicListItem
                  key={pessoa.id}
                  meta={pessoa.id}
                  subtitle={[
                    pessoa.cargo ?? "Cargo não informado",
                    pessoa.matricula ? `Matrícula ${pessoa.matricula}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  title={pessoa.nome}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
