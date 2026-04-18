import { Client, ClientConfig, QueryResult } from 'pg' // QueryResult usato nel tipo di db.query

const getClientConfig = (): ClientConfig => {
  const connStr = process.env.LINKTOP_DB_URL
    || process.env.POSTGRES_URL
    || process.env.DATABASE_URL

  if (!connStr) {
    throw new Error('Nessuna variabile DB configurata (LINKTOP_DB_URL / POSTGRES_URL / DATABASE_URL)')
  }

  return {
    connectionString: connStr.split('?')[0],
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  }
}

// Esegue una callback con un Client dedicato, chiude la connessione al termine.
// Uso: const rows = await withDb(c => c.query(...))
export async function withDb<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client(getClientConfig())
  await client.connect()
  try {
    return await fn(client)
  } finally {
    await client.end()
  }
}

// Compatibilità: pool-like object con solo .query() per le route esistenti
const db = {
  query: <T = any>(text: string, values?: any[]): Promise<QueryResult<T>> =>
    withDb(c => c.query<T>(text, values)),
}

export default db
