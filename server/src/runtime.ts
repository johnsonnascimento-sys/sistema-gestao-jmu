import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { AppConfig } from "./config";

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

export interface RuntimeStatusPayload {
  status: "up" | "ready";
  environment: AppConfig["NODE_ENV"];
  version: string;
  commitSha: string | null;
  startedAt: string;
  checkedAt: string;
  uptimeSeconds: number;
  database?: {
    status: "ready";
    latencyMs: number;
  };
}

export function createRuntimeStatus(
  config: AppConfig,
  status: RuntimeStatusPayload["status"],
  extra?: Pick<RuntimeStatusPayload, "database">,
): RuntimeStatusPayload {
  const checkedAt = new Date();

  return {
    status,
    environment: config.NODE_ENV,
    version: config.APP_VERSION ?? getPackageVersion(),
    commitSha: config.APP_COMMIT_SHA ?? null,
    startedAt: processStartedAt.toISOString(),
    checkedAt: checkedAt.toISOString(),
    uptimeSeconds: Math.max(0, Math.floor((checkedAt.getTime() - processStartedAt.getTime()) / 1000)),
    ...(extra ?? {}),
  };
}
