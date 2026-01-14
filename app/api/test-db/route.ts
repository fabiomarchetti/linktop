import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // 1. Controlla variabili d'ambiente (oscurando i valori sensibili)
    const envVars = {
      POSTGRES_URL: process.env.POSTGRES_URL ? 'Presente ✅' : 'Mancante ❌',
      DATABASE_URL: process.env.DATABASE_URL ? 'Presente ✅' : 'Mancante ❌',
      DB_HOST: process.env.DB_HOST || 'Mancante',
      NODE_ENV: process.env.NODE_ENV,
    }

    // 2. Prova connessione al DB
    const client = await pool.connect()
    let dbResult
    try {
      const res = await client.query('SELECT version(), current_database()')
      dbResult = res.rows[0]
    } finally {
      client.release()
    }

    return NextResponse.json({
      status: 'success',
      message: 'Database connesso correttamente! 🚀',
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
        POSTGRES_URL: process.env.POSTGRES_URL ? 'Presente (len: ' + process.env.POSTGRES_URL.length + ')' : 'Mancante',
        DATABASE_URL: process.env.DATABASE_URL ? 'Presente' : 'Mancante'
      }
    }, { status: 500 })
  }
}
