import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

/**
 * POST /api/supervisione/login
 * Autentica un supervisore (familiare/medico) con codice fiscale del paziente
 * e password uguale al paziente (prime 6 lettere del CF in minuscolo)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { codice_fiscale, password } = body

    if (!codice_fiscale || !password) {
      return NextResponse.json(
        { success: false, error: 'Codice fiscale e password sono obbligatori' },
        { status: 400 }
      )
    }

    const result = await pool.query(
      `SELECT
        id,
        nome,
        cognome,
        codice_fiscale,
        data_nascita,
        sesso,
        telefono
      FROM linktop_pazienti
      WHERE codice_fiscale = $1
        AND password = $2
        AND active = true`,
      [codice_fiscale.toUpperCase(), password.toLowerCase()]
    )

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Credenziali non valide' },
        { status: 401 }
      )
    }

    const paziente = result.rows[0]

    return NextResponse.json({
      success: true,
      message: 'Accesso supervisione effettuato',
      paziente: {
        id: paziente.id,
        nome: paziente.nome,
        cognome: paziente.cognome,
        codice_fiscale: paziente.codice_fiscale,
      }
    })
  } catch (error: any) {
    console.error('Errore login supervisione:', error)
    return NextResponse.json(
      { success: false, error: 'Errore durante il login', details: error.message },
      { status: 500 }
    )
  }
}
