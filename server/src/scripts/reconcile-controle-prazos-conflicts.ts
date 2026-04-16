import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { Pool, PoolClient } from "pg";
import { loadConfig } from "../config";
import { createPool } from "../db";
import { readControlePrazosSheet } from "./exceljs-sheet";
import {
  buildImportAnnotation,
  parseControlePrazosRow,
  type ControlePrazosRawRow,
  type ParsedControlePrazosRow,
} from "./import-controle-prazos-lib";

type ReconcileMode = "preview" | "apply";

interface ReportItem {
  rowNumber: number;
  targetPreId: string | null;
  status: "ready" | "merged" | "already_reconciled" | "skipped" | "unresolved" | "error";
  action: string;
  warnings: string[];
  errors: string[];
}

interface ImportReportItem {
  rowNumber: number;
  assunto: string;
  status: string;
  conflicts: string[];
  errors: string[];
}

function getArg(name: string) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((item) => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : "";
}

function extractTargets(item: ImportReportItem) {
  return Array.from(
    new Set(
      item.conflicts.flatMap((message) =>
        Array.from(message.matchAll(/processo ([A-Z0-9-]+)/g)).map((match) => match[1]).filter(Boolean),
      ),
    ),
  );
}

async function resolveImportUserId(pool: Pool, userRef: string) {
  const isNumeric = /^\d+$/.test(userRef);
  const result = await pool.query<{ id: number }>(
    isNumeric
      ? "select id from adminlog.app_user where id = $1::bigint limit 1"
      : "select id from adminlog.app_user where lower(email) = lower($1) limit 1",
    [userRef],
  );

  if (!result.rows[0]) {
    throw new Error(`Usuario nao encontrado: ${userRef}`);
  }

  return Number(result.rows[0].id);
}

async function findTargetForDuplicateError(pool: Pool, row: ParsedControlePrazosRow) {
  const result = await pool.query<{ pre_id: string }>(
    `
      select pre_id
      from adminlog.pre_demanda
      where assunto_norm = lower(regexp_replace(trim($1), '\s+', ' ', 'g'))
        and data_referencia = $2::date
        and solicitante_norm = lower(regexp_replace(trim($3), '\s+', ' ', 'g'))
      order by updated_at desc
      limit 2
    `,
    [row.assunto, row.dataReferencia, row.interessados[0] ?? "Sem interessado informado"],
  );

  if (result.rows.length === 1 && result.rows[0]) {
    return result.rows[0].pre_id;
  }

  return null;
}

async function findOrCreateInteressado(client: PoolClient, nome: string) {
  const found = await client.query<{ id: string }>(
    `
      select id
      from adminlog.interessados
      where lower(regexp_replace(trim(nome), '\s+', ' ', 'g')) = lower(regexp_replace(trim($1), '\s+', ' ', 'g'))
      order by updated_at desc
      limit 1
    `,
    [nome],
  );

  if (found.rows[0]) {
    return String(found.rows[0].id);
  }

  const created = await client.query<{ id: string }>("insert into adminlog.interessados (nome) values ($1) returning id", [nome]);
  if (!created.rows[0]) {
    throw new Error(`Falha ao criar interessado ${nome}`);
  }

  return String(created.rows[0].id);
}

function buildReconcileAnnotation(params: {
  filePath: string;
  sheetName: string;
  rowNumber: number;
  targetPreId: string;
  warnings: string[];
}) {
  const base = buildImportAnnotation({
    filePath: params.filePath,
    sheetName: params.sheetName,
    rowNumber: params.rowNumber,
    warnings: params.warnings,
  });

  return `${base}\nreconciled_to=${params.targetPreId}`;
}

async function mergeRowIntoTarget(
  pool: Pool,
  row: ParsedControlePrazosRow,
  targetPreId: string,
  userId: number,
  filePath: string,
  sheetName: string,
) {
  const client = await pool.connect();

  try {
    await client.query("begin");
    const targetResult = await client.query<{
      id: number;
      anotacoes: string | null;
      observacoes: string | null;
      metadata: Record<string, unknown> | null;
      prazo_inicial: string | null;
      prazo_intermediario: string | null;
      prazo_final: string | null;
      data_conclusao: string | null;
    }>(
      `
        select id, anotacoes, observacoes, metadata, prazo_inicial, prazo_intermediario, prazo_final, data_conclusao
        from adminlog.pre_demanda
        where pre_id = $1
        limit 1
        for update
      `,
      [targetPreId],
    );

    const target = targetResult.rows[0];
    if (!target) {
      throw new Error(`Processo alvo nao encontrado: ${targetPreId}`);
    }

    const rowMarker = `linha=${row.rowNumber}`;
    if ((target.anotacoes ?? "").includes(rowMarker) && (target.anotacoes ?? "").includes(`arquivo=${filePath}`)) {
      await client.query("rollback");
      return "already_reconciled" as const;
    }

    const existingSeiResult = await client.query<{ sei_numero: string }>(
      "select sei_numero from adminlog.demanda_sei_vinculos where pre_demanda_id = $1",
      [target.id],
    );
    const existingSei = new Set(existingSeiResult.rows.map((item) => item.sei_numero));

    for (const seiNumber of row.seiNumbers) {
      if (existingSei.has(seiNumber)) {
        continue;
      }

      await client.query(
        `
          insert into adminlog.demanda_sei_vinculos (pre_demanda_id, sei_numero, principal, observacoes, created_by_user_id)
          values ($1, $2, false, $3, $4)
          on conflict (pre_demanda_id, sei_numero) do nothing
        `,
        [target.id, seiNumber, `SEI adicional reconciliado da linha ${row.rowNumber}.`, userId],
      );
    }

    for (const [index, interessadoNome] of row.interessados.entries()) {
      const interessadoId = await findOrCreateInteressado(client, interessadoNome);
      await client.query(
        `
          insert into adminlog.demanda_interessados (pre_demanda_id, interessado_id, papel, created_by_user_id)
          values ($1, $2::uuid, $3, $4)
          on conflict (pre_demanda_id, interessado_id) do nothing
        `,
        [target.id, interessadoId, index === 0 ? "solicitante" : "interessado", userId],
      );
    }

    for (const andamento of row.andamentos) {
      await client.query(
        `
          insert into adminlog.andamentos (pre_demanda_id, data_hora, descricao, tipo, created_by_user_id)
          values ($1, coalesce($2::timestamptz, now()), $3, 'manual', $4)
        `,
        [target.id, andamento.dataHora, `[Reconciliação linha ${row.rowNumber}] ${andamento.descricao}`, userId],
      );
    }

    const existingTasks = await client.query<{ descricao: string }>(
      "select descricao from adminlog.tarefas_pendentes where pre_demanda_id = $1",
      [target.id],
    );
    const existingTaskDescriptions = new Set(existingTasks.rows.map((item) => item.descricao));
    for (const tarefa of row.tarefas) {
      const descricao = `[Reconciliação linha ${row.rowNumber}] ${tarefa}`;
      if (existingTaskDescriptions.has(descricao)) {
        continue;
      }

      await client.query(
        `
          insert into adminlog.tarefas_pendentes (pre_demanda_id, descricao, tipo, created_by_user_id)
          values ($1, $2, 'livre', $3)
        `,
        [target.id, descricao, userId],
      );
    }

    const currentMetadata = target.metadata ?? {};
    const mergedMetadata = {
      ...currentMetadata,
      frequencia: currentMetadata.frequencia ?? row.metadata.frequencia,
      pagamento_envolvido:
        typeof currentMetadata.pagamento_envolvido === "boolean"
          ? currentMetadata.pagamento_envolvido || row.metadata.pagamentoEnvolvido === true
          : row.metadata.pagamentoEnvolvido,
      audiencia_data: currentMetadata.audiencia_data ?? row.metadata.audienciaData,
      audiencia_status: currentMetadata.audiencia_status ?? row.metadata.audienciaStatus,
    };

    const annotation = buildReconcileAnnotation({
      filePath,
      sheetName,
      rowNumber: row.rowNumber,
      targetPreId,
      warnings: row.warnings,
    });
    const appendedObservation = row.observacoes ? `${target.observacoes ? `${target.observacoes}\n\n` : ""}${row.observacoes}` : target.observacoes;

    await client.query(
      `
        update adminlog.pre_demanda
        set
          observacoes = $2,
          prazo_inicial = coalesce(prazo_inicial, $3::date),
          prazo_intermediario = coalesce(prazo_intermediario, $4::date),
          prazo_final = coalesce(prazo_final, $5::date),
          data_conclusao = coalesce(data_conclusao, $6::date),
          metadata = $7::jsonb,
          anotacoes = case
            when anotacoes is null or anotacoes = '' then $8
            else anotacoes || E'\n\n' || $8
          end
        where id = $1
      `,
      [
        target.id,
        appendedObservation,
        row.prazoInicial.value,
        row.prazoIntermediario.value,
        row.prazoFinal.value,
        row.dataConclusao,
        JSON.stringify(mergedMetadata),
        annotation,
      ],
    );

    await client.query("commit");
    return "merged" as const;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function run() {
  const mode = (getArg("mode") || "preview") as ReconcileMode;
  const filePath = getArg("file");
  const reportPath = getArg("report");
  const userRef = getArg("user");
  const sheetName = getArg("sheet") || "Prazos";
  const outDir = resolve(getArg("reportDir") || join(process.cwd(), "tmp", "import-reports"));

  if (!filePath || !reportPath || !userRef) {
    throw new Error("Uso: node reconcile-controle-prazos-conflicts.js --mode=preview|apply --file=<xlsx> --report=<json> --user=<id-ou-email>");
  }

  const report = JSON.parse(await import("node:fs/promises").then((fs) => fs.readFile(reportPath, "utf8"))) as { items: ImportReportItem[] };
  const rows = await readControlePrazosSheet(filePath, sheetName);

  const config = loadConfig();
  const pool = createPool(config.DATABASE_URL);

  try {
    const userId = await resolveImportUserId(pool, userRef);
    const results: ReportItem[] = [];

    for (const item of report.items) {
      if (item.status !== "conflict" && item.status !== "error") {
        continue;
      }

      const raw = rows[item.rowNumber - 2];
      if (!raw) {
        results.push({
          rowNumber: item.rowNumber,
          targetPreId: null,
          status: "error",
          action: "Linha nao encontrada na planilha.",
          warnings: [],
          errors: ["Linha ausente no arquivo XLSX."],
        });
        continue;
      }

      const parsed = parseControlePrazosRow(raw, item.rowNumber);
      const targets = item.status === "conflict" ? extractTargets(item) : [];
      const targetPreId = targets.length === 1 ? targets[0] ?? null : item.status === "error" ? await findTargetForDuplicateError(pool, parsed) : null;

      if (!targetPreId) {
        results.push({
          rowNumber: item.rowNumber,
          targetPreId: null,
          status: "unresolved",
          action: "Conflito sem alvo unico; manter para revisao manual.",
          warnings: parsed.warnings,
          errors: item.errors,
        });
        continue;
      }

      if (mode === "preview") {
        results.push({
          rowNumber: item.rowNumber,
          targetPreId,
          status: "ready",
          action: `Pronta para reconciliar com ${targetPreId}.`,
          warnings: parsed.warnings,
          errors: [],
        });
        continue;
      }

      try {
        const mergedStatus = await mergeRowIntoTarget(pool, parsed, targetPreId, userId, filePath, sheetName);
        results.push({
          rowNumber: item.rowNumber,
          targetPreId,
          status: mergedStatus,
          action: mergedStatus === "merged" ? `Dados anexados a ${targetPreId}.` : `Linha ja reconciliada em ${targetPreId}.`,
          warnings: parsed.warnings,
          errors: [],
        });
      } catch (error) {
        results.push({
          rowNumber: item.rowNumber,
          targetPreId,
          status: "error",
          action: `Falha ao reconciliar com ${targetPreId}.`,
          warnings: parsed.warnings,
          errors: [error instanceof Error ? error.message : "Erro desconhecido."],
        });
      }
    }

    await mkdir(outDir, { recursive: true });
    const outputPath = join(outDir, `controle-prazos-reconcile-${mode}-${Date.now()}.json`);
    const payload = {
      mode,
      filePath,
      reportPath,
      generatedAt: new Date().toISOString(),
      totals: {
        total: results.length,
        ready: results.filter((item) => item.status === "ready").length,
        merged: results.filter((item) => item.status === "merged").length,
        alreadyReconciled: results.filter((item) => item.status === "already_reconciled").length,
        unresolved: results.filter((item) => item.status === "unresolved").length,
        errors: results.filter((item) => item.status === "error").length,
      },
      items: results,
    };

    await writeFile(outputPath, JSON.stringify(payload, null, 2), "utf8");
    console.log(JSON.stringify({ ok: true, outputPath, totals: payload.totals }, null, 2));
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
