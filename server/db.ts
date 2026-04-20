import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../shared/schema";

const DATABASE_URL = process.env.DATABASE_URL;

function shouldUseSsl(connectionString: string) {
  try {
    const url = new URL(connectionString);
    const host = url.hostname;
    // Assume remote Postgres requires SSL (Neon/Supabase/etc.). Local dev often doesn't.
    return !(host === "localhost" || host === "127.0.0.1");
  } catch {
    return true;
  }
}

const { Pool } = pg;

export const pool =
  DATABASE_URL && DATABASE_URL !== ""
    ? new Pool({
        connectionString: DATABASE_URL,
        ssl: shouldUseSsl(DATABASE_URL) ? { rejectUnauthorized: false } : undefined,
        connectionTimeoutMillis: 20000,
        idleTimeoutMillis: 10000,
        keepAlive: true,
        max: 10,
      })
    : null;

export const db = pool ? drizzle(pool, { schema }) : null;

// Log database connection status
if (db) {
  console.log("[Database] Connection initialized successfully");
} else {
  console.log("[Database] No DATABASE_URL provided, database features disabled");
}

// Ensure minimal DB compatibility for the current app schema.
// This is intentionally idempotent so it won't break existing deployments.
if (pool) {
  void (async () => {
    try {
      await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS plot_id varchar`);
      await pool.query(`ALTER TABLE block_plots ALTER COLUMN id SET DEFAULT gen_random_uuid()`);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[DB] Failed to ensure DB compatibility columns/defaults:", e);
    }
  })();
}
