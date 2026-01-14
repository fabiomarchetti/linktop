import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

/**
 * GET /api/users/[id]
 * Recupera un singolo utente LINKTOP
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const result = await pool.query(`
      SELECT
        u.id, u.nome, u.cognome, u.username, u.email, u.active, u.ruolo_id,
        u.created_at, u.updated_at,
        r.nome_ruolo, r.descrizione as ruolo_descrizione, r.livello_accesso
      FROM linktop_users u
      JOIN linktop_ruoli r ON u.ruolo_id = r.id
      WHERE u.id = $1
    `, [id])

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Utente non trovato' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      user: result.rows[0]
    })
  } catch (error: any) {
    console.error('❌ Errore recupero utente LINKTOP:', error)
    return NextResponse.json(
      { error: 'Errore recupero utente', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/users/[id]
 * Aggiorna un utente LINKTOP
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { nome, cognome, username, email, password, ruolo_id, active } = body

    // Verifica se l'utente esiste
    const existingUser = await pool.query('SELECT id FROM linktop_users WHERE id = $1', [id])
    if (existingUser.rows.length === 0) {
      return NextResponse.json(
        { error: 'Utente non trovato' },
        { status: 404 }
      )
    }

    // Verifica username unico (escludendo l'utente corrente)
    if (username) {
      const duplicateUser = await pool.query(
        'SELECT id FROM linktop_users WHERE username = $1 AND id != $2',
        [username, id]
      )
      if (duplicateUser.rows.length > 0) {
        return NextResponse.json(
          { error: 'Username già esistente' },
          { status: 409 }
        )
      }
    }

    // Costruisci query dinamica
    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (nome !== undefined) {
      updates.push(`nome = $${paramIndex++}`)
      values.push(nome)
    }
    if (cognome !== undefined) {
      updates.push(`cognome = $${paramIndex++}`)
      values.push(cognome)
    }
    if (username !== undefined) {
      updates.push(`username = $${paramIndex++}`)
      values.push(username)
    }
    if (email !== undefined) {
      updates.push(`email = $${paramIndex++}`)
      values.push(email)
    }
    if (password !== undefined && password !== '') {
      // Password in chiaro (GPS style)
      updates.push(`password = $${paramIndex++}`)
      values.push(password)
    }
    if (ruolo_id !== undefined) {
      updates.push(`ruolo_id = $${paramIndex++}`)
      values.push(ruolo_id)
    }
    if (active !== undefined) {
      updates.push(`active = $${paramIndex++}`)
      values.push(active)
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'Nessun campo da aggiornare' },
        { status: 400 }
      )
    }

    values.push(id)
    const result = await pool.query(
      `UPDATE linktop_users SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${paramIndex}
       RETURNING id, nome, cognome, username, email, ruolo_id, active, updated_at`,
      values
    )

    return NextResponse.json({
      success: true,
      message: 'Operatore aggiornato con successo',
      user: result.rows[0]
    })
  } catch (error: any) {
    console.error('❌ Errore aggiornamento utente LINKTOP:', error)
    return NextResponse.json(
      { error: 'Errore aggiornamento utente', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/users/[id]
 * Elimina un utente LINKTOP
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Verifica se l'utente esiste
    const existingUser = await pool.query('SELECT id, username FROM linktop_users WHERE id = $1', [id])
    if (existingUser.rows.length === 0) {
      return NextResponse.json(
        { error: 'Utente non trovato' },
        { status: 404 }
      )
    }

    // Impedisci eliminazione dell'admin principale
    if (existingUser.rows[0].username === 'admin') {
      return NextResponse.json(
        { error: 'Non puoi eliminare l\'utente admin principale' },
        { status: 403 }
      )
    }

    await pool.query('DELETE FROM linktop_users WHERE id = $1', [id])

    return NextResponse.json({
      success: true,
      message: 'Operatore eliminato con successo'
    })
  } catch (error: any) {
    console.error('❌ Errore eliminazione utente LINKTOP:', error)
    return NextResponse.json(
      { error: 'Errore eliminazione utente', details: error.message },
      { status: 500 }
    )
  }
}
