import { Pool } from 'pg'

// Porta automatica: 5432 (prod VPS) o 5433 (dev locale con tunnel SSH)
const defaultPort = process.env.NODE_ENV === 'production' ? '5432' : '5433'

// Configurazione del pool di connessioni PostgreSQL
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || defaultPort),
  database: process.env.DB_NAME || 'gpswatch',
  user: process.env.DB_USER || 'gpsuser',
  password: process.env.DB_PASSWORD || 'GpsWatch2025',
  max: 20, // Numero massimo di client nel pool
  idleTimeoutMillis: 30000, // Chiudi client inattivi dopo 30 secondi
  connectionTimeoutMillis: 5000, // Timeout connessione
})

// Gestione errori del pool
pool.on('error', (err) => {
  console.error('❌ Errore pool PostgreSQL LINKTOP:', err)
})

// Log connessione
pool.on('connect', () => {
  const env = process.env.NODE_ENV || 'development'
  const port = process.env.DB_PORT || defaultPort
  console.log(`🏥 LINKTOP: Connesso al database (${env}, porta ${port})`)
})

export default pool
