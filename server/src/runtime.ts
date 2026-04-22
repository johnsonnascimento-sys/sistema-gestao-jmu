import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { AppConfig } from "./config";
import type { RuntimeStatus } from "./domain/types";

const processStartedAt = new Date();
let cachedPackageVersion: string | null = null;

function getPackageVersion() {
  if (cachedPackageVersion) {
    return cachedPackageVersion;
  }

  const packageJsonPath = join(process.cwd(), "package.json");

  if (!existsSync(packageJsonPath)) {
    cachedPackageVersion = "0.0.0";
    return cachedPackageVersion;
  }

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version?: string };
    cachedPackageVersion = packageJson.version?.trim() || "0.0.0";
  } catch {
    cachedPackageVersion = "0.0.0";
  }

  return cachedPackageVersion;
}

export function createRuntimeStatus(
  config: AppConfig,
  status: RuntimeStatus["status"],
  extra?: Pick<RuntimeStatus, "database">,
): RuntimeStatus {
  const checkedAt = new Date();

  return {
    status,
    environment: config.NODE_ENV,
    version: config.APP_VERSION ?? getPackageVersion(),
    commitSha: config.APP_COMMIT_SHA ?? null,
    commitAt: config.APP_COMMIT_AT ?? null,
    startedAt: processStartedAt.toISOString(),
    checkedAt: checkedAt.toISOString(),
    uptimeSeconds: Math.max(0, Math.floor((checkedAt.getTime() - processStartedAt.getTime()) / 1000)),
    ...(extra ?? {}),
  };
}
