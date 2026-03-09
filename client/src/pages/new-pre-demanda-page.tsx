import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { FormField } from "../components/form-field";
import { PageHeader } from "../components/page-header";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { ApiError, createPreDemanda } from "../lib/api";

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
      const created = await createPreDemanda(form);
      setResult({
        preId: created.existingPreId ?? created.preId,
        idempotent: created.idempotent,
      });
    } catch (nextError) {
      if (nextError instanceof ApiError && nextError.status === 409) {
        setConflictPreId(getConflictPreId(nextError.details));
        setError("Ja existe uma demanda registada com estes dados.");
      } else {
        setError(nextError instanceof ApiError ? nextError.message : "Falha ao criar demanda.");
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
