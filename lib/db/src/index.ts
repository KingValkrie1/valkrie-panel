import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

// Keep the API server and WhatsApp bot usable without a provisioned database.
// pg opens connections lazily, so the default localhost pool does not block
// startup; database-backed dashboard features will report their own errors.
export const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : new Pool();
export const db = drizzle(pool, { schema });

export * from "./schema";
