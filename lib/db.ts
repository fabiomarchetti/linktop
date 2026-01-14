import { Pool, PoolConfig } from 'pg'

// Configurazione flessibile per supportare sia Supabase (Vercel) che VPS legacy
const getPoolConfig = (): PoolConfig => {
  // 1. Priorità a Supabase / Vercel Postgres
  if (process.env.POSTGRES_URL) {
    console.log('🔌 LINKTOP: Usando configurazione Supabase/Vercel')
    return {
      connectionString: process.env.POSTGRES_URL,
      ssl: {
        rejectUnauthorized: false // Necessario per Supabase in alcune config
      },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    }
  }

  // 2. Fallback alla configurazione manuale (VPS o Tunnel SSH locale)
  console.log('🔌 LINKTOP: Usando configurazione Manuale/Legacy')
  const defaultPort = process.env.NODE_ENV === 'production' ? '5432' : '5433'
  
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || defaultPort),
    database: process.env.DB_NAME || 'gpswatch',
    user: process.env.DB_USER || 'gpsuser',
    password: process.env.DB_PASSWORD || 'GpsWatch2025',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    // Nota: SSL disabilitato di default per tunnel locale/VPS legacy
    // Se la VPS richiedesse SSL, aggiungere qui la logica
  }
}

// Crea il pool con la configurazione determinata
const pool = new Pool(getPoolConfig())

// Gestione errori del pool
pool.on('error', (err) => {
  console.error('❌ Errore pool PostgreSQL LINKTOP:', err)
})

// Log connessione (opzionale, utile per debug)
pool.on('connect', () => {
  // Evitiamo log troppo verbosi in produzione, ma utile per sapere che è connesso
  // console.log(`🏥 LINKTOP: Connessione al database attiva`)
})

export default pool
