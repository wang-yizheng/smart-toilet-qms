import { Pool } from 'pg'
import { env } from './env'

/**
 * PostgreSQL connection pool.
 * Credentials come from DATABASE_URL in .env (local docker postgres).
 */
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
})

pool.on('error', (err) => {
  // Unexpected pool errors should not crash the process
  console.error('Unexpected PostgreSQL pool error', err)
})

/**
 * Run a single query and return rows.
 */
export async function query<T = any>(
  text: string,
  params: any[] = []
): Promise<T[]> {
  const res = await pool.query(text, params)
  return res.rows as T[]
}

/**
 * Run a function inside a transaction.
 */
export async function transaction<T>(
  fn: (client: typeof pool extends { query: any } ? any : any) => Promise<T>
): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

export default pool
