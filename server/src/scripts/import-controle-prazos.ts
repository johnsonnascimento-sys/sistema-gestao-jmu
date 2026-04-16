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

type ImportMode = "preview" | "apply";

interface ImportReportItem {
  rowNumber: number;
  assunto: string;
  status: "ready" | "conflict" | "rejected" | "already_imported" | "imported" | "error" | "skipped";
  inferredStatus: ParsedControlePrazosRow["status"] | null;
  seiNumbers: string[];
  warnings: string[];
  errors: string[];
  conflicts: string[];
  action: string;
  preId?: string | null;
}

function getArg(name: string) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((item) => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : "";
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

function parseApprovedRows(value: string) {
  const result = new Set<number>();
  for (const part of value.split(",").map((item) => item.trim()).filter(Boolean)) {
    const range = part.match(/^(\d+)-(\d+)$/);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      for (let current = start; current <= end; current += 1) {
        result.add(current);
      }
      continue;
    }

    const rowNumber = Number(part);
    if (Number.isInteger(rowNumber) && rowNumber > 0) {
      result.add(rowNumber);
    }
  }
  return result;
}

async function resolveImportUserId(pool: Pool, userRef: string) {
  if (!userRef) {
    throw new Error("Informe --user=<id ou email>.");
  }

  const isNumeric = /^\d+$/.test(userRef);
  const result = await pool.query<{ id: number }>(
    isNumeric
      ? "select id from adminlog.app_user where id = $1::bigint limit 1"
      : "select id from adminlog.app_user where lower(email) = lower($1) limit 1",
    [userRef],
  );

  if (!result.rows[0]) {
    throw new Error(`Usuario de importacao nao encontrado: ${userRef}`);
  }

  return Number(result.rows[0].id);
}

async function resolveSetor(pool: Pool, sigla: string) {
  const result = await pool.query<{ id: string; sigla: string }>(
    "select id, sigla from adminlog.setores where upper(sigla) = upper($1) limit 1",
    [sigla],
  );

  if (!result.rows[0]) {
    throw new Error(`Setor nao encontrado: ${sigla}`);
  }

  return result.rows[0];
}

async function detectConflicts(pool: Pool, row: ParsedControlePrazosRow, sourceInfo: { filePath: string; sheetName: string }) {
  const conflicts: string[] = [];

  const imported = await pool.query<{ pre_id: string }>(
    "select pre_id from adminlog.pre_demanda where anotacoes ilike $1 limit 1",
    [`%arquivo=${sourceInfo.filePath}%aba=${sourceInfo.sheetName}%linha=${row.rowNumber}%`],
  );

  if (imported.rows[0]) {
    conflicts.push(`Linha ja importada no pre_id ${String(imported.rows[0].pre_id)}.`);
    return { alreadyImported: true, conflicts };
  }

  if (row.seiNumbers.length) {
    const seiConflict = await pool.query<{ pre_id: string; sei_numero: string }>(
      `
        select pd.pre_id, vinculo.sei_numero
        from adminlog.demanda_sei_vinculos vinculo
        inner join adminlog.pre_demanda pd on pd.id = vinculo.pre_demanda_id
        where vinculo.sei_numero = any($1::varchar[])
        order by pd.updated_at desc
      `,
      [row.seiNumbers],
    );

    for (const item of seiConflict.rows) {
      conflicts.push(`SEI ${String(item.sei_numero)} ja vinculado ao processo ${String(item.pre_id)}.`);
    }
  }

  if (row.interessados[0] && row.dataReferencia) {
    const identityConflict = await pool.query<{ pre_id: string }>(
      `
        select pre_id
        from adminlog.pre_demanda
        where assunto_norm = lower(regexp_replace(trim($1), '\s+', ' ', 'g'))
          and data_referencia = $2::date
          and solicitante_norm = lower(regexp_replace(trim($3), '\s+', ' ', 'g'))
        limit 3
      `,
      [row.assunto, row.dataReferencia, row.interessados[0]],
    );

    for (const item of identityConflict.rows) {
      conflicts.push(`Assunto/data/pessoa principal ja correspondem ao processo ${String(item.pre_id)}.`);
    }
  }

  return { alreadyImported: false, conflicts };
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

  const created = await client.query<{ id: string }>(
    "insert into adminlog.interessados (nome) values ($1) returning id",
    [nome],
  );

  const createdRow = created.rows[0];
  if (!createdRow) {
    throw new Error(`Falha ao criar interessado: ${nome}`);
  }

  return String(createdRow.id);
}

async function applyRow(
  pool: Pool,
  row: ParsedControlePrazosRow,
  userId: number,
  setorId: string,
  filePath: string,
  sheetName: string,
) {
  const client = await pool.connect();

  try {
    await client.query("begin");

    const primaryInteressado = row.interessados[0];
    if (!primaryInteressado) {
      throw new Error(`Linha ${row.rowNumber} sem interessado principal resolvido.`);
    }

    const primaryInteressadoId = await findOrCreateInteressado(client, primaryInteressado);
    const metadata = {
      frequencia: row.metadata.frequencia,
      pagamento_envolvido: row.metadata.pagamentoEnvolvido,
      audiencia_data: row.metadata.audienciaData,
      audiencia_status: row.metadata.audienciaStatus,
    };

    const created = await client.query<{ id: number; pre_id: string }>(
      `
        insert into adminlog.pre_demanda (
          pre_id,
          solicitante,
          assunto,
          data_referencia,
          status,
          observacoes,
          prazo_inicial,
          prazo_intermediario,
          prazo_final,
          data_conclusao,
          setor_atual_id,
          metadata,
          created_by_user_id
        )
        values (
          adminlog.fn_generate_pre_id($1::date),
          $2,
          $3,
          $1::date,
          $4,
          $5,
          $6::date,
          $7::date,
          $8::date,
          $9::date,
          $10::uuid,
          coalesce($11::jsonb, '{}'::jsonb),
          $12
        )
        returning id, pre_id
      `,
      [
        row.dataReferencia,
        primaryInteressado,
        row.assunto,
        row.status,
        row.observacoes,
        row.prazoInicial.value,
        row.prazoIntermediario.value,
        row.prazoFinal.value,
        row.dataConclusao,
        setorId,
        JSON.stringify(metadata),
        userId,
      ],
    );

    const createdRow = created.rows[0];
    if (!createdRow) {
      throw new Error(`Falha ao criar demanda para a linha ${row.rowNumber}.`);
    }

    const preDemandaId = Number(createdRow.id);
    const preId = String(createdRow.pre_id);

    await client.query(
      `
        insert into adminlog.demanda_setores_fluxo (
          pre_demanda_id,
          setor_id,
          status,
          observacoes,
          created_by_user_id
        )
        values ($1, $2::uuid, 'ativo', 'Setor inicial definido pela importacao historica.', $3)
      `,
      [preDemandaId, setorId, userId],
    );

    await client.query(
      `
        insert into adminlog.demanda_interessados (pre_demanda_id, interessado_id, papel, created_by_user_id)
        values ($1, $2::uuid, 'solicitante', $3)
        on conflict (pre_demanda_id, interessado_id) do nothing
      `,
      [preDemandaId, primaryInteressadoId, userId],
    );

    for (const interessado of row.interessados.slice(1)) {
      const interessadoId = await findOrCreateInteressado(client, interessado);
      await client.query(
        `
          insert into adminlog.demanda_interessados (pre_demanda_id, interessado_id, papel, created_by_user_id)
          values ($1, $2::uuid, 'interessado', $3)
          on conflict (pre_demanda_id, interessado_id) do nothing
        `,
        [preDemandaId, interessadoId, userId],
      );
    }

    if (row.seiNumbers[0]) {
      await client.query(
        `
          insert into adminlog.pre_to_sei_link (pre_id, sei_numero, sei_numero_inicial, observacoes, linked_by_user_id)
          values ($1, $2, $2, $3, $4)
        `,
        [preId, row.seiNumbers[0], "Associacao principal criada pela importacao historica.", userId],
      );
    }

    for (const [index, seiNumber] of row.seiNumbers.entries()) {
      await client.query(
        `
          insert into adminlog.demanda_sei_vinculos (pre_demanda_id, sei_numero, principal, observacoes, created_by_user_id)
          values ($1, $2, $3, $4, $5)
          on conflict (pre_demanda_id, sei_numero) do nothing
        `,
        [
          preDemandaId,
          seiNumber,
          index === 0,
          index === 0 ? "SEI principal importado da planilha." : "SEI associado importado da planilha.",
          userId,
        ],
      );
    }

    for (const andamento of row.andamentos) {
      await client.query(
        `
          insert into adminlog.andamentos (pre_demanda_id, data_hora, descricao, tipo, created_by_user_id)
          values ($1, coalesce($2::timestamptz, now()), $3, 'manual', $4)
        `,
        [preDemandaId, andamento.dataHora, andamento.descricao, userId],
      );
    }

    for (const tarefa of row.tarefas) {
      await client.query(
        `
          insert into adminlog.tarefas_pendentes (pre_demanda_id, descricao, tipo, created_by_user_id)
          values ($1, $2, 'livre', $3)
        `,
        [preDemandaId, tarefa, userId],
      );
    }

    const annotation = buildImportAnnotation({
      filePath,
      sheetName,
      rowNumber: row.rowNumber,
      warnings: row.warnings,
    });

    await client.query(
      `
        update adminlog.pre_demanda
        set anotacoes = case
          when anotacoes is null or anotacoes = '' then $2
          else anotacoes || E'\n\n' || $2
        end
        where id = $1
      `,
      [preDemandaId, annotation],
    );

    await client.query("commit");
    return preId;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function run() {
  const mode = (getArg("mode") || "preview") as ImportMode;
  const filePath = getArg("file") || "C:/Users/jtnas/Downloads/Controle de Prazos.xlsx";
  const sheetName = getArg("sheet") || "Prazos";
  const userRef = getArg("user");
  const setorSigla = getArg("setor") || "SETAD2A2CJM";
  const approvedRows = parseApprovedRows(getArg("rows"));
  const reportDir = resolve(getArg("reportDir") || join(process.cwd(), "tmp", "import-reports"));
  const failOnConflict = hasFlag("fail-on-conflict");

  if (!["preview", "apply"].includes(mode)) {
    throw new Error("Modo invalido. Use --mode=preview ou --mode=apply.");
  }

  const config = loadConfig();
  const pool = createPool(config.DATABASE_URL);

  try {
    const userId = await resolveImportUserId(pool, userRef);
    const setor = await resolveSetor(pool, setorSigla);
    const rows = await readControlePrazosSheet(filePath, sheetName);
    const report: ImportReportItem[] = [];

    for (const [index, raw] of rows.entries()) {
      const rowNumber = index + 2;
      const parsed = parseControlePrazosRow(raw, rowNumber);
      const item: ImportReportItem = {
        rowNumber,
        assunto: parsed.assunto,
        status: "ready",
        inferredStatus: parsed.status,
        seiNumbers: parsed.seiNumbers,
        warnings: [...parsed.warnings],
        errors: [...parsed.errors],
        conflicts: [],
        action: "Importar.",
      };

      if (parsed.errors.length) {
        item.status = "rejected";
        item.action = "Corrigir linha antes de importar.";
        report.push(item);
        continue;
      }

      const conflictResult = await detectConflicts(pool, parsed, { filePath, sheetName });
      item.conflicts = conflictResult.conflicts;

      if (conflictResult.alreadyImported) {
        item.status = "already_imported";
        item.action = "Ja importada anteriormente.";
        report.push(item);
        continue;
      }

      if (conflictResult.conflicts.length) {
        item.status = "conflict";
        item.action = "Revisar conflito antes da carga.";
        report.push(item);
        continue;
      }

      if (mode === "apply") {
        const shouldApply = approvedRows.size === 0 || approvedRows.has(rowNumber);
        if (!shouldApply) {
          item.status = "skipped";
          item.action = "Nao aprovada para esta execucao.";
          report.push(item);
          continue;
        }

        try {
          item.preId = await applyRow(pool, parsed, userId, setor.id, filePath, sheetName);
          item.status = "imported";
          item.action = `Importada em ${item.preId}.`;
        } catch (error) {
          item.status = "error";
          item.errors.push(error instanceof Error ? error.message : "Falha inesperada ao importar.");
          item.action = "Falha ao importar linha.";
        }
      }

      report.push(item);
    }

    if (failOnConflict && report.some((item) => item.status === "conflict")) {
      throw new Error("Conflitos detectados no preview.");
    }

    await mkdir(reportDir, { recursive: true });
    const reportPath = join(reportDir, `controle-prazos-${mode}-${Date.now()}.json`);
    const summary = {
      mode,
      filePath,
      sheetName,
      generatedAt: new Date().toISOString(),
      totals: {
        rows: report.length,
        ready: report.filter((item) => item.status === "ready").length,
        imported: report.filter((item) => item.status === "imported").length,
        conflicts: report.filter((item) => item.status === "conflict").length,
        rejected: report.filter((item) => item.status === "rejected").length,
        alreadyImported: report.filter((item) => item.status === "already_imported").length,
        skipped: report.filter((item) => item.status === "skipped").length,
        errors: report.filter((item) => item.status === "error").length,
      },
      items: report,
    };

    await writeFile(reportPath, JSON.stringify(summary, null, 2), "utf8");
    console.log(JSON.stringify({ ok: true, reportPath, totals: summary.totals }, null, 2));
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
