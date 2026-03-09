import { FormEvent, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { StatusPill } from "../components/status-pill";
import { ApiError, associateSei, getAudit, getPreDemanda } from "../lib/api";
import { formatSeiInput, isValidSei, normalizeSeiValue } from "../lib/sei";
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
  const isSeiValid = isValidSei(associationForm.sei_numero);

  async function load() {
    const [nextRecord, nextAudit] = await Promise.all([getPreDemanda(preId), getAudit(preId)]);
    setRecord(nextRecord);
    setAudit(nextAudit);
    setAssociationForm((current) => ({
      ...current,
      sei_numero: nextRecord.currentAssociation?.seiNumero ?? normalizeSeiValue(current.sei_numero),
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

    if (!isSeiValid) {
      setError("Informe um numero SEI no formato 0000000-00.0000.0.00.0000.");
      return;
    }

    try {
      const response = await associateSei(preId, {
        ...associationForm,
        sei_numero: normalizeSeiValue(associationForm.sei_numero),
      });
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
                onChange={(event) => setAssociationForm((current) => ({ ...current, sei_numero: formatSeiInput(event.target.value) }))}
                placeholder="0000000-00.0000.0.00.0000"
                value={associationForm.sei_numero}
              />
            </label>

            <p className={`field-hint ${isSeiValid ? "field-hint-valid" : ""}`}>
              Formato aceito pelo backend: <code>0000000-00.0000.0.00.0000</code>. Entradas parciais podem aparecer como <code>000000/00-00.000</code>.
            </p>

            <label>
              Motivo
              <textarea onChange={(event) => setAssociationForm((current) => ({ ...current, motivo: event.target.value }))} rows={3} value={associationForm.motivo} />
            </label>

            <label>
              Observacoes
              <textarea onChange={(event) => setAssociationForm((current) => ({ ...current, observacoes: event.target.value }))} rows={3} value={associationForm.observacoes} />
            </label>

            <button className="button primary" disabled={!isSeiValid} type="submit">
              Salvar associacao
            </button>
          </form>
        </article>
      </section>

      <section className="panel">
        <div className="section-header">
          <div>
            <h3>Auditoria de reassociacoes</h3>
            <p className="muted">A API atual nao informa o utilizador responsavel pela alteracao. A timeline destaca data, troca realizada e motivo registrado.</p>
          </div>
        </div>

        {audit.length ? (
          <div className="timeline">
            {audit.map((item) => (
              <article className="timeline-item" key={item.id}>
                <div className="timeline-marker" aria-hidden="true" />

                <div className="timeline-card">
                  <div className="timeline-heading">
                    <div>
                      <p className="kanban-label">Alteracao registada</p>
                      <h4>{new Date(item.registradoEm).toLocaleString("pt-BR")}</h4>
                    </div>
                    <span className="timeline-author">Autor nao informado</span>
                  </div>

                  <p className="timeline-change">
                    <strong>{item.seiNumeroAnterior}</strong> para <strong>{item.seiNumeroNovo}</strong>
                  </p>

                  <p className="timeline-reason">{item.motivo?.trim() || "Motivo nao informado."}</p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">Nenhuma reassociacao auditada ate ao momento.</p>
        )}
      </section>
    </section>
  );
}
