import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

/**
 * GET /api/users
 * Recupera tutti gli utenti LINKTOP
 */
export async function GET(request: NextRequest) {
  try {
    const result = await pool.query(`
      SELECT
        u.id, u.nome, u.cognome, u.username, u.email, u.active, u.ruolo_id,
        u.created_at, u.updated_at,
        r.nome_ruolo, r.descrizione as ruolo_descrizione, r.livello_accesso
      FROM linktop_users u
      JOIN linktop_ruoli r ON u.ruolo_id = r.id
      ORDER BY u.created_at DESC
    `)

    return NextResponse.json({
      success: true,
      users: result.rows,
      total: result.rows.length
    })
  } catch (error: any) {
    console.error('❌ Errore recupero utenti LINKTOP:', error)
    return NextResponse.json(
      { error: 'Errore recupero utenti', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/users
 * Crea un nuovo utente LINKTOP
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { nome, cognome, username, email, password, ruolo_id } = body

    if (!nome || !cognome || !username || !password || !ruolo_id) {
      return NextResponse.json(
        { error: 'Tutti i campi obbligatori devono essere compilati' },
        { status: 400 }
      )
    }

    // Verifica username unico
    const existingUser = await pool.query(
      'SELECT id FROM linktop_users WHERE username = $1',
      [username]
    )

    if (existingUser.rows.length > 0) {
      return NextResponse.json(
        { error: 'Username già esistente' },
        { status: 409 }
      )
    }

    // Password in chiaro (GPS style)
    const result = await pool.query(
      `INSERT INTO linktop_users (nome, cognome, username, email, password, ruolo_id, active)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING id, nome, cognome, username, email, ruolo_id, active, created_at`,
      [nome, cognome, username, email, password, ruolo_id]
    )

    return NextResponse.json({
      success: true,
      message: 'Operatore creato con successo',
      user: result.rows[0]
    }, { status: 201 })
  } catch (error: any) {
    console.error('❌ Errore creazione utente LINKTOP:', error)
    return NextResponse.json(
      { error: 'Errore creazione utente', details: error.message },
      { status: 500 }
    )
  }
}
