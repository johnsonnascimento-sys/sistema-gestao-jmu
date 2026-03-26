import { Pool } from "pg";

function shouldUseSsl(connectionString: string) {
  try {
    const url = new URL(connectionString);
    const sslMode = url.searchParams.get("sslmode")?.toLowerCase();
    const hostname = url.hostname.toLowerCase();

    if (sslMode === "disable") {
      return false;
    }

    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
      return false;
    }
  } catch {
    if (connectionString.includes("localhost")) {
      return false;
    }
  }

  return true;
}

export function createPool(connectionString: string) {
  return new Pool({
    connectionString,
    ssl: shouldUseSsl(connectionString) ? { rejectUnauthorized: false } : false,
  });
}

export type DatabasePool = Pool;
