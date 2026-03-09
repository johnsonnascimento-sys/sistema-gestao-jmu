import { Pool } from "pg";

export function createPool(connectionString: string) {
  return new Pool({
    connectionString,
    ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false },
  });
}

export type DatabasePool = Pool;
