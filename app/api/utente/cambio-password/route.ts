import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

/**
 * POST /api/utente/cambio-password
 * Cambia la password di un paziente
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { utente_id, password_attuale, nuova_password } = body

    // Validazione input
    if (!utente_id || !password_attuale || !nuova_password) {
      return NextResponse.json(
        { success: false, error: 'Tutti i campi sono obbligatori' },
        { status: 400 }
      )
    }

    if (nuova_password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'La nuova password deve essere di almeno 6 caratteri' },
        { status: 400 }
      )
    }

    // Verifica password attuale
    const verifyResult = await pool.query(
      `SELECT id, password FROM linktop_pazienti WHERE id = $1 AND active = true`,
      [utente_id]
    )

    if (verifyResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Utente non trovato' },
        { status: 404 }
      )
    }

    const utente = verifyResult.rows[0]

    // Verifica password attuale (in chiaro)
    if (utente.password !== password_attuale.toLowerCase()) {
      return NextResponse.json(
        { success: false, error: 'Password attuale non corretta' },
        { status: 401 }
      )
    }

    // Aggiorna password (updated_at gestito da trigger automatico)
    const updateResult = await pool.query(
      `UPDATE linktop_pazienti
       SET password = $1
       WHERE id = $2
       RETURNING id, nome, cognome, codice_fiscale`,
      [nuova_password.toLowerCase(), utente_id]
    )

    if (updateResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Errore durante l\'aggiornamento' },
        { status: 500 }
      )
    }

    console.log(`✅ Password cambiata per paziente ID ${utente_id}`)

    return NextResponse.json({
      success: true,
      message: 'Password cambiata con successo',
      utente: updateResult.rows[0]
    })
  } catch (error: any) {
    console.error('❌ Errore cambio password:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Errore durante il cambio password',
        details: error.message
      },
      { status: 500 }
    )
  }
}
