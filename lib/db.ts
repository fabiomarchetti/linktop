import { Pool, PoolConfig } from 'pg'

// Configurazione flessibile per supportare sia Supabase (Vercel) che VPS legacy
const getPoolConfig = (): PoolConfig => {
  // Debug: Stampa le variabili d'ambiente disponibili (solo chiavi, per sicurezza)
  if (process.env.NODE_ENV === 'production') {
    const envKeys = Object.keys(process.env).filter(k => k.includes('DB') || k.includes('POSTGRES') || k.includes('URL'))
    console.log('🔍 DEBUG ENV VARS:', envKeys.join(', '))
  }

  // 1. Priorità a Supabase / Vercel Postgres (POSTGRES_URL o DATABASE_URL)
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL
  
  if (connectionString) {
    console.log('🔌 LINKTOP: Usando configurazione Supabase/Vercel (Connection String rilevata)')
    return {
      connectionString: connectionString,
      ssl: {
        rejectUnauthorized: false // Necessario per Supabase in alcune config
      },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    }
  }

  // 2. Fallback alla configurazione manuale (VPS o Tunnel SSH locale)
  console.log('🔌 LINKTOP: Usando configurazione Manuale/Legacy (Nessuna Connection String trovata)')
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
  // console.log(`🏥 LINKTOP: Connessione al database attiva`)
})

export default pool
