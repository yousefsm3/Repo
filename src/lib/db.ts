import { Pool, PoolClient } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
});

/**
 * withTenantClient — CRITICAL security primitive.
 *
 * Every query that touches tenant-scoped tables (events, photos, faces) MUST
 * go through this function. It sets `app.tenant_id` on the Postgres session,
 * which the Row-Level Security policies in db/schema.sql use to filter rows.
 *
 * This means tenant isolation is enforced at the DATABASE layer, not just in
 * application code — even a bug in a route handler cannot leak Tenant B's
 * data to Tenant A, because Postgres itself refuses to return those rows.
 */
export async function withTenantClient<T>(
  tenantId: string,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // set_config(..., true) scopes the setting to the current transaction only
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * withAdminClient — for Super Admin operations ONLY.
 * The DB role used here must have BYPASSRLS (configured at the database level,
 * NOT via this code) so it can see across all tenants. Never expose this to
 * tenant-facing routes.
 */
export async function withAdminClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export default pool;
