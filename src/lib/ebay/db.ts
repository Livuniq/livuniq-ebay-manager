import { neon } from '@neondatabase/serverless';

export function getDatabaseUrl(): string | null {
  if (process.env.STORAGE_URL) return process.env.STORAGE_URL;
  if (process.env.STORAGE_POSTGRES_URL) return process.env.STORAGE_POSTGRES_URL;
  if (process.env.STORAGE_DATABASE_URL) return process.env.STORAGE_DATABASE_URL;
  if (process.env.POSTGRES_URL) return process.env.POSTGRES_URL;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.NEON_DATABASE_URL) return process.env.NEON_DATABASE_URL;
  if (process.env.POSTGRES_PRISMA_URL) return process.env.POSTGRES_PRISMA_URL;
  if (process.env.POSTGRES_URL_NON_POOLING) return process.env.POSTGRES_URL_NON_POOLING;

  // Dynamic fallback: detect any postgresql connection string injected by Vercel
  for (const [key, val] of Object.entries(process.env)) {
    if (
      val &&
      typeof val === 'string' &&
      (val.startsWith('postgres://') || val.startsWith('postgresql://'))
    ) {
      return val;
    }
  }

  return null;
}

export function isDbConfigured(): boolean {
  return Boolean(getDatabaseUrl());
}

let sqlClient: ReturnType<typeof neon> | null = null;

export function getSql() {
  const dbUrl = getDatabaseUrl();
  if (!dbUrl) return null;
  if (!sqlClient) {
    sqlClient = neon(dbUrl);
  }
  return sqlClient;
}

let isInitialized = false;

export async function initDbSchema(): Promise<boolean> {
  if (isInitialized) return true;
  const sql = getSql();
  if (!sql) return false;

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS ebay_app_state (
        key VARCHAR(64) PRIMARY KEY,
        data JSONB NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;
    isInitialized = true;
    return true;
  } catch (err) {
    console.error('[Neon DB] Schema init error:', err);
    return false;
  }
}

export async function fetchDbState(): Promise<any | null> {
  const sql = getSql();
  if (!sql) return null;
  try {
    await initDbSchema();
    const rows = (await sql`
      SELECT data FROM ebay_app_state WHERE key = 'main' LIMIT 1
    `) as Array<{ data: any }>;
    if (rows && Array.isArray(rows) && rows.length > 0) {
      return rows[0].data;
    }
  } catch (err) {
    console.error('[Neon DB] fetchDbState error:', err);
  }
  return null;
}

export async function persistDbState(data: any): Promise<boolean> {
  const sql = getSql();
  if (!sql) return false;
  try {
    await initDbSchema();
    const jsonStr = typeof data === 'string' ? data : JSON.stringify(data);
    await sql`
      INSERT INTO ebay_app_state (key, data, updated_at)
      VALUES ('main', ${jsonStr}::jsonb, CURRENT_TIMESTAMP)
      ON CONFLICT (key)
      DO UPDATE SET
        data = EXCLUDED.data,
        updated_at = CURRENT_TIMESTAMP
    `;
    return true;
  } catch (err) {
    console.error('[Neon DB] persistDbState error:', err);
    return false;
  }
}
