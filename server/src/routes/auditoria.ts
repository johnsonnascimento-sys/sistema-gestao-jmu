import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { DatabasePool } from "../db";

const listAuditSchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export async function registerAuditRoutes(app: FastifyInstance, options: { pool: DatabasePool }) {
  const { pool } = options;

  app.get("/api/admin/auditoria", { preHandler: [app.authenticate, app.authorize("admin.audit.read")] }, async (request, reply) => {
    const query = listAuditSchema.parse(request.query);
    const limit = query.limit ?? 50;

    const result = await pool.query(`
      SELECT 
        'status' as type,
        audit.id,
        audit.pre_id as "preId",
        audit.status_anterior as "valorAnterior",
        audit.status_novo as "valorNovo",
        audit.motivo,
        audit.observacoes,
        audit.registrado_em as "registradoEm",
        changed_by.name as "changedByName"
      FROM adminlog.pre_demanda_status_audit audit
      LEFT JOIN adminlog.app_user changed_by ON changed_by.id = audit.changed_by_user_id

      UNION ALL

      SELECT 
        'sei' as type,
        audit.id,
        audit.pre_id as "preId",
        audit.sei_numero_anterior as "valorAnterior",
        audit.sei_numero_novo as "valorNovo",
        audit.motivo,
        audit.observacoes,
        audit.registrado_em as "registradoEm",
        changed_by.name as "changedByName"
      FROM adminlog.pre_to_sei_link_audit audit
      LEFT JOIN adminlog.app_user changed_by ON changed_by.id = audit.changed_by_user_id

      UNION ALL

      SELECT 
        'user' as type,
        audit.id,
        CAST(audit.target_user_id as TEXT) as "preId",
        audit.role_anterior as "valorAnterior",
        audit.role_novo as "valorNovo",
        audit.action as motivo,
        '' as observacoes,
        audit.registrado_em as "registradoEm",
        actor.name as "changedByName"
      FROM adminlog.admin_user_audit audit
      LEFT JOIN adminlog.app_user actor ON actor.id = audit.actor_user_id

      UNION ALL

      SELECT
        'delete' as type,
        audit.id,
        audit.pre_id as "preId",
        audit.status as "valorAnterior",
        null as "valorNovo",
        audit.motivo,
        audit.snapshot::text as observacoes,
        audit.deleted_at as "registradoEm",
        audit.deleted_by_name as "changedByName"
      FROM adminlog.pre_demanda_delete_audit audit

      ORDER BY "registradoEm" DESC
      LIMIT $1;
    `, [limit]);

    return reply.send({
      ok: true,
      data: result.rows,
      error: null
    });
  });
}
