import { promises as fs } from "node:fs";
import { join } from "node:path";
import type { AppConfig } from "../config";
import type { BackupArtifactSummary, BackupStatusSummary } from "../domain/types";

function toArtifact(fileName: string, sizeBytes: number, modifiedAt: Date): BackupArtifactSummary {
  return {
    fileName,
    sizeBytes,
    modifiedAt: modifiedAt.toISOString(),
  };
}

export async function describeBackupStatus(config: AppConfig): Promise<BackupStatusSummary> {
  const directory = config.OPS_BACKUP_DIR;
  const schemaName = config.OPS_BACKUP_SCHEMA;

  try {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const artifacts = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.startsWith(`gestor-${schemaName}-`) && entry.name.endsWith(".sql.gz"))
        .map(async (entry) => {
          const stats = await fs.stat(join(directory, entry.name));
          return {
            fileName: entry.name,
            sizeBytes: stats.size,
            modifiedAt: stats.mtime,
          };
        }),
    );

    const recentBackups = artifacts
      .filter((artifact) => artifact.sizeBytes > 0)
      .sort((left, right) => right.modifiedAt.getTime() - left.modifiedAt.getTime() || right.fileName.localeCompare(left.fileName))
      .slice(0, 5)
      .map((artifact) => toArtifact(artifact.fileName, artifact.sizeBytes, artifact.modifiedAt));

    return {
      directory,
      schemaName,
      visible: true,
      lastBackup: recentBackups[0] ?? null,
      recentBackups,
      message: recentBackups.length ? null : "Nenhum backup valido foi encontrado no diretorio montado.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Diretorio de backup indisponivel.";

    return {
      directory,
      schemaName,
      visible: false,
      lastBackup: null,
      recentBackups: [],
      message,
    };
  }
}
