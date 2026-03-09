import { FormEvent, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { StatusPill } from "../components/status-pill";
import { ApiError, associateSei, getAudit, getPreDemanda } from "../lib/api";
import type { PreDemanda, PreDemandaAuditRecord } from "../types";

export function PreDemandaDetailPage() {
  const { preId = "" } = useParams();
  const [record, setRecord] = useState<PreDemanda | null>(null);
  const [audit, setAudit] = useState<PreDemandaAuditRecord[]>([]);
  const [error, setError] = useState("");
  const [associationForm, setAssociationForm] = useState({
    sei_numero: "",
    motivo: "",
    observacoes: "",
  });
  const [message, setMessage] = useState("");

  async function load() {
    const [nextRecord, nextAudit] = await Promise.all([getPreDemanda(preId), getAudit(preId)]);
    setRecord(nextRecord);
    setAudit(nextAudit);
    setAssociationForm((current) => ({
      ...current,
      sei_numero: nextRecord.currentAssociation?.seiNumero ?? current.sei_numero,
    }));
  }

  useEffect(() => {
    void (async () => {
      try {
        await load();
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Falha ao carregar demanda.");
      }
    })();
  }, [preId]);

  async function handleAssociation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    try {
      const response = await associateSei(preId, associationForm);
      await load();
      setMessage(response.audited ? "SEI reassociado com auditoria registrada." : "SEI associado com sucesso.");
    } catch (nextError) {
      setError(nextError instanceof ApiError ? nextError.message : "Falha ao associar SEI.");
    }
  }

  if (!record) {
    return <div className="panel">Carregando demanda...</div>;
  }

  return (
    <section className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">{record.preId}</p>
          <h2>{record.assunto}</h2>
        </div>

        <StatusPill status={record.status} />
      </header>

      {error ? <p className="error-text">{error}</p> : null}
      {message ? <p className="notice notice-success">{message}</p> : null}

      <section className="details-grid">
        <article className="panel">
          <h3>Dados da demanda</h3>
          <dl className="detail-list">
            <div>
              <dt>Solicitante</dt>
              <dd>{record.solicitante}</dd>
            </div>
            <div>
              <dt>Data de referencia</dt>
              <dd>{new Date(record.dataReferencia).toLocaleDateString("pt-BR")}</dd>
            </div>
            <div>
              <dt>Fonte</dt>
              <dd>{record.fonte ?? "-"}</dd>
            </div>
            <div>
              <dt>Descricao</dt>
              <dd>{record.descricao ?? "-"}</dd>
            </div>
            <div>
              <dt>Observacoes</dt>
              <dd>{record.observacoes ?? "-"}</dd>
            </div>
          </dl>
        </article>

        <article className="panel">
          <h3>Associacao PRE para SEI</h3>
          <p className="muted">SEI atual: {record.currentAssociation?.seiNumero ?? "nao associado"}</p>

          <form className="form-stack" onSubmit={handleAssociation}>
            <label>
              Numero SEI
              <input
                onChange={(event) => setAssociationForm((current) => ({ ...current, sei_numero: event.target.value }))}
                placeholder="0000000-00.2026.4.00.0000"
                value={associationForm.sei_numero}
              />
            </label>

            <label>
              Motivo
              <textarea onChange={(event) => setAssociationForm((current) => ({ ...current, motivo: event.target.value }))} rows={3} value={associationForm.motivo} />
            </label>

            <label>
              Observacoes
              <textarea onChange={(event) => setAssociationForm((current) => ({ ...current, observacoes: event.target.value }))} rows={3} value={associationForm.observacoes} />
            </label>

            <button className="button primary" type="submit">
              Salvar associacao
            </button>
          </form>
        </article>
      </section>

      <section className="panel">
        <h3>Auditoria de reassociacoes</h3>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Quando</th>
                <th>SEI anterior</th>
                <th>SEI novo</th>
                <th>Motivo</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((item) => (
                <tr key={item.id}>
                  <td>{new Date(item.registradoEm).toLocaleString("pt-BR")}</td>
                  <td>{item.seiNumeroAnterior}</td>
                  <td>{item.seiNumeroNovo}</td>
                  <td>{item.motivo ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
