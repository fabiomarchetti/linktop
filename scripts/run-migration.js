/**
 * Script per eseguire le migrazioni del database
 * Uso: node scripts/run-migration.js <numero_migrazione>
 * Esempio: node scripts/run-migration.js 008
 */

const fs = require('fs')
const path = require('path')
const { Pool } = require('pg')

// Configurazione database
const pool = new Pool({
  user: 'postgres',
  password: 'GpsWatch2025',
  database: 'linktop',
  host: 'localhost',
  port: 5432,
})

async function runMigration(migrationNumber) {
  try {
    // Trova il file di migrazione
    const migrationFile = path.join(__dirname, '..', 'migrations', `${migrationNumber}_*.sql`)
    const files = fs.readdirSync(path.join(__dirname, '..', 'migrations'))
    const targetFile = files.find(f => f.startsWith(migrationNumber))

    if (!targetFile) {
      console.error(`❌ Migrazione ${migrationNumber} non trovata`)
      process.exit(1)
    }

    const migrationPath = path.join(__dirname, '..', 'migrations', targetFile)
    const sql = fs.readFileSync(migrationPath, 'utf-8')

    console.log(`📝 Esecuzione migrazione: ${targetFile}`)
    console.log('─'.repeat(70))

    // Esegui la migrazione
    const result = await pool.query(sql)

    console.log('─'.repeat(70))
    console.log(`✅ Migrazione ${migrationNumber} completata con successo!`)

    await pool.end()
    process.exit(0)

  } catch (error) {
    console.error('❌ Errore durante la migrazione:', error.message)
    console.error(error)
    await pool.end()
    process.exit(1)
  }
}

// Leggi il numero di migrazione dai parametri
const migrationNumber = process.argv[2]

if (!migrationNumber) {
  console.error('❌ Specifica il numero della migrazione')
  console.error('Uso: node scripts/run-migration.js <numero>')
  console.error('Esempio: node scripts/run-migration.js 008')
  process.exit(1)
}

runMigration(migrationNumber)
