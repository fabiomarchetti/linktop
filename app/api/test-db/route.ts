import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // 1. Controlla variabili d'ambiente
    const envVars = {
      LINKTOP_DB_URL: process.env.LINKTOP_DB_URL ? 'Presente (Override) ✅' : 'Mancante ❌',
      POSTGRES_URL: process.env.POSTGRES_URL ? 'Presente ✅' : 'Mancante ❌',
      DATABASE_URL: process.env.DATABASE_URL ? 'Presente ✅' : 'Mancante ❌',
      NODE_ENV: process.env.NODE_ENV,
    }

    // 2. Prova connessione al DB
    const client = await pool.connect()
    let dbResult
    let connectionInfo = 'Unknown'
    try {
      const res = await client.query('SELECT version(), current_database(), inet_server_addr(), inet_server_port()')
      dbResult = res.rows[0]
      connectionInfo = `Connected to ${dbResult.inet_server_addr}:${dbResult.inet_server_port}`
    } finally {
      client.release()
    }

    return NextResponse.json({
      status: 'success',
      message: 'Database connesso correttamente! 🚀',
      connection: connectionInfo,
      env: envVars,
      db: dbResult
    })

  } catch (error: any) {
    console.error('Test DB Error:', error)
    return NextResponse.json({
      status: 'error',
      message: 'Errore connessione database',
      error: error.message,
      code: error.code,
      details: error,
      env: {
        LINKTOP_DB_URL: process.env.LINKTOP_DB_URL ? 'Presente' : 'Mancante',
        POSTGRES_URL: process.env.POSTGRES_URL ? 'Presente' : 'Mancante'
      }
    }, { status: 500 })
  }
}
