import { Pool, PoolConfig } from 'pg'

/**
 * Configurazione Database Supabase per LINKTOP
 *
 * Priorità connection strings:
 * 1. LINKTOP_DB_URL (custom - per Supabase Session Pooler)
 * 2. POSTGRES_URL o DATABASE_URL (standard Vercel/Supabase)
 *
 * Note:
 * - In sviluppo locale usa .env.local con LINKTOP_DB_URL
 * - In produzione (Vercel) imposta LINKTOP_DB_URL nelle env vars
 * - SSL con rejectUnauthorized: false è necessario per Supabase Pooler
 */
const getPoolConfig = (): PoolConfig => {
  // 1. PRIORITÀ ASSOLUTA: Connection string custom (Supabase Session Pooler)
  if (process.env.LINKTOP_DB_URL) {
    console.log('🔌 LINKTOP: Connessione Supabase (LINKTOP_DB_URL)')

    // Rimuovi query params dalla URL se presenti (es. ?sslmode=...)
    const cleanUrl = process.env.LINKTOP_DB_URL.split('?')[0]

    return {
      connectionString: cleanUrl,
      ssl: {
        rejectUnauthorized: false // Necessario per Supabase Session Pooler
      },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    }
  }

  // 2. FALLBACK: Standard Supabase/Vercel connection string
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL

  if (connectionString) {
    console.log('🔌 LINKTOP: Connessione Supabase Standard (POSTGRES_URL/DATABASE_URL)')

    const cleanUrl = connectionString.split('?')[0]

    return {
      connectionString: cleanUrl,
      ssl: {
        rejectUnauthorized: false
      },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    }
  }

  // 3. NESSUNA CONFIGURAZIONE TROVATA
  throw new Error(
    '❌ LINKTOP: Nessuna configurazione database trovata!\n' +
    '   Imposta una delle seguenti variabili d\'ambiente:\n' +
    '   - LINKTOP_DB_URL (consigliato per Supabase Session Pooler)\n' +
    '   - POSTGRES_URL o DATABASE_URL (standard Vercel/Supabase)\n\n' +
    '   Vedi .env.local per un esempio o doc/SUPABASE_CONFIG.md per dettagli.'
  )
}

// Crea il pool con la configurazione determinata
const pool = new Pool(getPoolConfig())

// Gestione errori del pool
pool.on('error', (err) => {
  console.error('❌ Errore pool PostgreSQL LINKTOP:', err)
})

// Log connessione riuscita
pool.on('connect', () => {
  console.log('✅ LINKTOP: Connesso al database Supabase')
})

export default pool
