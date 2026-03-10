import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { FormField } from "../components/form-field";
import { PageHeader } from "../components/page-header";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { ApiError, appendRequestReference, createPreDemanda, formatAppError } from "../lib/api";

function getConflictPreId(details: unknown) {
  if (!details || typeof details !== "object") {
    return null;
  }

  const maybePreId = (details as Record<string, unknown>).existingPreId ?? (details as Record<string, unknown>).preId;
  return typeof maybePreId === "string" && maybePreId.length > 0 ? maybePreId : null;
}

export function NewPreDemandaPage() {
  const [form, setForm] = useState({
    solicitante: "",
    assunto: "",
    data_referencia: new Date().toISOString().slice(0, 10),
    descricao: "",
    fonte: "",
    observacoes: "",
    prazo_final: "",
    numero_judicial: "",
    pagamento_envolvido: false,
    frequencia: "",
  });
  const [error, setError] = useState("");
  const [conflictPreId, setConflictPreId] = useState<string | null>(null);
  const [result, setResult] = useState<{ preId: string; idempotent: boolean } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    setConflictPreId(null);
    setResult(null);

    try {
      const created = await createPreDemanda({
        solicitante: form.solicitante,
        assunto: form.assunto,
        data_referencia: form.data_referencia,
        descricao: form.descricao || undefined,
        fonte: form.fonte || undefined,
        observacoes: form.observacoes || undefined,
        prazo_final: form.prazo_final || null,
        numero_judicial: form.numero_judicial || null,
        metadata: {
          frequencia: form.frequencia || null,
          pagamento_envolvido: form.pagamento_envolvido,
        },
      });
      setResult({
        preId: created.existingPreId ?? created.preId,
        idempotent: created.idempotent,
      });
    } catch (nextError) {
      if (nextError instanceof ApiError && nextError.status === 409) {
        setConflictPreId(getConflictPreId(nextError.details));
        setError(appendRequestReference("Ja existe uma demanda registada com estes dados.", nextError.requestId));
      } else {
        setError(formatAppError(nextError, "Falha ao criar demanda."));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="grid gap-6">
      <PageHeader
        description="Registe a demanda informal com dados suficientes para triagem, deduplicacao e acompanhamento posterior."
        eyebrow="Cadastro"
        title="Nova pre-demanda"
      />

      <Card>
        <CardContent className="p-6">
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
            <FormField label="Solicitante">
              <Input onChange={(event) => setForm((current) => ({ ...current, solicitante: event.target.value }))} value={form.solicitante} />
            </FormField>

            <FormField label="Assunto">
              <Input onChange={(event) => setForm((current) => ({ ...current, assunto: event.target.value }))} value={form.assunto} />
            </FormField>

            <FormField label="Data de referencia">
              <Input onChange={(event) => setForm((current) => ({ ...current, data_referencia: event.target.value }))} type="date" value={form.data_referencia} />
            </FormField>

            <FormField label="Fonte">
              <Input onChange={(event) => setForm((current) => ({ ...current, fonte: event.target.value }))} placeholder="WhatsApp, e-mail, telefone..." value={form.fonte} />
            </FormField>

            <FormField className="md:col-span-2" label="Descricao">
              <Textarea onChange={(event) => setForm((current) => ({ ...current, descricao: event.target.value }))} rows={5} value={form.descricao} />
            </FormField>

            <FormField className="md:col-span-2" label="Observacoes">
              <Textarea onChange={(event) => setForm((current) => ({ ...current, observacoes: event.target.value }))} rows={4} value={form.observacoes} />
            </FormField>

            <details className="md:col-span-2 rounded-[24px] border border-slate-200 bg-slate-50/80 px-5 py-4">
              <summary className="cursor-pointer list-none text-sm font-semibold text-slate-950">
                Campos avancados
                <span className="ml-2 text-xs font-medium uppercase tracking-[0.2em] text-slate-500">prazo, pagamento e judicial</span>
              </summary>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <FormField label="Prazo final">
                  <Input onChange={(event) => setForm((current) => ({ ...current, prazo_final: event.target.value }))} type="date" value={form.prazo_final} />
                </FormField>

                <FormField label="Numero judicial">
                  <Input
                    onChange={(event) => setForm((current) => ({ ...current, numero_judicial: event.target.value }))}
                    placeholder="0001234-56.2026.9.99.9999"
                    value={form.numero_judicial}
                  />
                </FormField>

                <FormField className="md:col-span-2" label="Frequencia">
                  <Input
                    onChange={(event) => setForm((current) => ({ ...current, frequencia: event.target.value }))}
                    placeholder="Mensal, eventual, diaria..."
                    value={form.frequencia}
                  />
                </FormField>

                <label className="md:col-span-2 flex items-center justify-between rounded-[20px] border border-slate-200 bg-white px-4 py-3 text-sm">
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
              </div>
            </details>

            {error ? (
              <div className="md:col-span-2 rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                {error} {conflictPreId ? <Link className="underline" to={`/pre-demandas/${conflictPreId}`}>Abrir demanda existente</Link> : null}
              </div>
            ) : null}

            {result ? (
              <div className="md:col-span-2 rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                {result.idempotent ? "Demanda existente localizada." : "Demanda criada com sucesso."}{" "}
                <Link className="underline" to={`/pre-demandas/${result.preId}`}>
                  {result.preId}
                </Link>
              </div>
            ) : null}

            <div className="md:col-span-2 flex justify-end">
              <Button disabled={isSubmitting} type="submit">
                {isSubmitting ? "Salvando..." : "Salvar demanda"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
