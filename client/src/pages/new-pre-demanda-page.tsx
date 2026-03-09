import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError, createPreDemanda } from "../lib/api";

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
  const [result, setResult] = useState<{ preId: string; idempotent: boolean } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    setResult(null);

    try {
      const created = await createPreDemanda(form);
      setResult({
        preId: created.preId,
        idempotent: created.idempotent,
      });
    } catch (nextError) {
      setError(nextError instanceof ApiError ? nextError.message : "Falha ao criar demanda.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Cadastro</p>
          <h2>Nova pre-demanda</h2>
        </div>
      </header>

      <section className="panel">
        <form className="form-grid" onSubmit={handleSubmit}>
          <label>
            Solicitante
            <input onChange={(event) => setForm((current) => ({ ...current, solicitante: event.target.value }))} value={form.solicitante} />
          </label>

          <label>
            Assunto
            <input onChange={(event) => setForm((current) => ({ ...current, assunto: event.target.value }))} value={form.assunto} />
          </label>

          <label>
            Data de referencia
            <input
              onChange={(event) => setForm((current) => ({ ...current, data_referencia: event.target.value }))}
              type="date"
              value={form.data_referencia}
            />
          </label>

          <label>
            Fonte
            <input onChange={(event) => setForm((current) => ({ ...current, fonte: event.target.value }))} value={form.fonte} />
          </label>

          <label className="span-2">
            Descricao
            <textarea onChange={(event) => setForm((current) => ({ ...current, descricao: event.target.value }))} rows={5} value={form.descricao} />
          </label>

          <label className="span-2">
            Observacoes
            <textarea onChange={(event) => setForm((current) => ({ ...current, observacoes: event.target.value }))} rows={4} value={form.observacoes} />
          </label>

          {error ? <p className="error-text span-2">{error}</p> : null}

          {result ? (
            <p className={`notice ${result.idempotent ? "notice-warning" : "notice-success"} span-2`}>
              {result.idempotent ? "Demanda existente localizada." : "Demanda criada com sucesso."}{" "}
              <Link to={`/pre-demandas/${result.preId}`}>{result.preId}</Link>
            </p>
          ) : null}

          <button className="button primary" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Salvando..." : "Salvar demanda"}
          </button>
        </form>
      </section>
    </section>
  );
}
