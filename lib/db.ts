import { Pool, PoolConfig } from 'pg'

// Configurazione flessibile per supportare sia Supabase (Vercel) che VPS legacy
const getPoolConfig = (): PoolConfig => {
  // Debug: Stampa le variabili d'ambiente disponibili (solo chiavi, per sicurezza)
  if (process.env.NODE_ENV === 'production') {
    const envKeys = Object.keys(process.env).filter(k => k.includes('DB') || k.includes('POSTGRES') || k.includes('URL'))
    console.log('🔍 DEBUG ENV VARS:', envKeys.join(', '))
  }

  // 0. Priorità ASSOLUTA alla variabile custom per override manuale (es. Pooler)
  if (process.env.LINKTOP_DB_URL) {
    console.log('🔌 LINKTOP: Usando configurazione CUSTOM (LINKTOP_DB_URL)')
    return {
      connectionString: process.env.LINKTOP_DB_URL,
      ssl: { rejectUnauthorized: false },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000, // Timeout aumentato per sicurezza
    }
  }

  // 1. Priorità a Supabase / Vercel Postgres (POSTGRES_URL o DATABASE_URL)
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL
  
  if (connectionString) {
    console.log('🔌 LINKTOP: Usando configurazione Standard Supabase/Vercel')
    return {
      connectionString: connectionString,
      ssl: { rejectUnauthorized: false },
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

export default pool
