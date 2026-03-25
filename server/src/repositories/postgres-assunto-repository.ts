import type { Pool, QueryResultRow } from "pg";
import type { Assunto } from "../domain/types";
import { AppError } from "../errors";
import type { AssuntoRepository, CreateAssuntoInput, UpdateAssuntoInput } from "./types";

function mapSetor(row: QueryResultRow, prefix: string) {
  if (!row[`${prefix}_id`]) {
    return null;
  }

  return {
    id: String(row[`${prefix}_id`]),
    sigla: String(row[`${prefix}_sigla`]),
    nomeCompleto: String(row[`${prefix}_nome_completo`]),
    createdAt: new Date(row[`${prefix}_created_at`]).toISOString(),
    updatedAt: new Date(row[`${prefix}_updated_at`]).toISOString(),
  };
}

export class PostgresAssuntoRepository implements AssuntoRepository {
  constructor(private readonly pool: Pool) {}

  async list() {
    const assuntos = await this.pool.query("select * from adminlog.assuntos order by nome asc");
    return Promise.all(assuntos.rows.map((row) => this.hydrate(String(row.id), row)));
  }

  async getById(id: string) {
    const result = await this.pool.query("select * from adminlog.assuntos where id = $1::uuid limit 1", [id]);
    return result.rows[0] ? this.hydrate(id, result.rows[0]) : null;
  }

  async create(input: CreateAssuntoInput) {
    const inserted = await this.pool.query(
      `
        insert into adminlog.assuntos (nome, descricao)
        values ($1, $2)
        returning *
      `,
      [input.nome, input.descricao ?? null],
    );

    const assuntoId = String(inserted.rows[0].id);
    await this.syncChildren(assuntoId, input);
    return this.hydrate(assuntoId, inserted.rows[0]);
  }

  async update(input: UpdateAssuntoInput) {
    const updated = await this.pool.query(
      `
        update adminlog.assuntos
        set nome = $2,
            descricao = $3,
            updated_at = now()
        where id = $1::uuid
        returning *
      `,
      [input.id, input.nome, input.descricao ?? null],
    );

    if (!updated.rows[0]) {
      throw new AppError(404, "ASSUNTO_NOT_FOUND", "Assunto nao encontrado.");
    }

    await this.syncChildren(input.id, input);
    return this.hydrate(input.id, updated.rows[0]);
  }

  private async syncChildren(assuntoId: string, input: CreateAssuntoInput) {
    await this.pool.query("delete from adminlog.assunto_normas where assunto_id = $1::uuid", [assuntoId]);
    await this.pool.query("delete from adminlog.assunto_procedimentos where assunto_id = $1::uuid", [assuntoId]);

    for (const normaId of input.normaIds ?? []) {
      await this.pool.query(
        `
          insert into adminlog.assunto_normas (assunto_id, norma_id)
          values ($1::uuid, $2::uuid)
          on conflict do nothing
        `,
        [assuntoId, normaId],
      );
    }

    const procedimentos = (input.procedimentos ?? [])
      .filter((item) => item.descricao.trim().length > 0)
      .map((item, index) => ({
        ordem: item.ordem ?? index + 1,
        descricao: item.descricao.trim(),
        horarioInicio: item.horarioInicio ?? null,
        horarioFim: item.horarioFim ?? null,
        setorDestinoId: item.setorDestinoId ?? null,
      }))
      .sort((left, right) => left.ordem - right.ordem);

    for (const procedimento of procedimentos) {
      await this.pool.query(
        `
          insert into adminlog.assunto_procedimentos (assunto_id, ordem, descricao, horario_inicio, horario_fim, setor_destino_id)
          values ($1::uuid, $2, $3, $4::time, $5::time, $6::uuid)
        `,
        [assuntoId, procedimento.ordem, procedimento.descricao, procedimento.horarioInicio, procedimento.horarioFim, procedimento.setorDestinoId],
      );
    }
  }

  private async hydrate(id: string, row: QueryResultRow): Promise<Assunto> {
    const [normasResult, procedimentosResult] = await Promise.all([
      this.pool.query(
        `
          select norma.*
          from adminlog.assunto_normas assunto_norma
          inner join adminlog.normas norma on norma.id = assunto_norma.norma_id
          where assunto_norma.assunto_id = $1::uuid
          order by norma.data_norma desc, norma.numero asc
        `,
        [id],
      ),
      this.pool.query(
        `
          select
            procedimento.*,
            setor.id as setor_id,
            setor.sigla as setor_sigla,
            setor.nome_completo as setor_nome_completo,
            setor.created_at as setor_created_at,
            setor.updated_at as setor_updated_at
          from adminlog.assunto_procedimentos procedimento
          left join adminlog.setores setor on setor.id = procedimento.setor_destino_id
          where procedimento.assunto_id = $1::uuid
          order by procedimento.ordem asc, procedimento.created_at asc
        `,
        [id],
      ),
    ]);

    return {
      id,
      nome: String(row.nome),
      descricao: row.descricao ? String(row.descricao) : null,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
      normas: normasResult.rows.map((norma) => ({
        id: String(norma.id),
        numero: String(norma.numero),
        dataNorma: new Date(norma.data_norma).toISOString().slice(0, 10),
        origem: String(norma.origem),
        createdAt: new Date(norma.created_at).toISOString(),
        updatedAt: new Date(norma.updated_at).toISOString(),
      })),
      procedimentos: procedimentosResult.rows.map((procedimento) => ({
        id: String(procedimento.id),
        ordem: Number(procedimento.ordem),
        descricao: String(procedimento.descricao),
        horarioInicio: procedimento.horario_inicio ? String(procedimento.horario_inicio).slice(0, 5) : null,
        horarioFim: procedimento.horario_fim ? String(procedimento.horario_fim).slice(0, 5) : null,
        setorDestino: mapSetor(procedimento, "setor"),
        createdAt: new Date(procedimento.created_at).toISOString(),
        updatedAt: new Date(procedimento.updated_at).toISOString(),
      })),
    };
  }
}
