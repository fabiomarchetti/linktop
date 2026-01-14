import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

/**
 * POST /api/utente/login
 * Autentica un utente/paziente con codice fiscale e password
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

    // Verifica credenziali
    const result = await pool.query(
      `SELECT
        id,
        nome,
        cognome,
        codice_fiscale,
        data_nascita,
        sesso,
        telefono,
        gruppo_sanguigno,
        allergie,
        patologie,
        emergenza_nome,
        emergenza_telefono,
        device_id
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

    const utente = result.rows[0]

    return NextResponse.json({
      success: true,
      message: 'Login effettuato con successo',
      utente: {
        id: utente.id,
        nome: utente.nome,
        cognome: utente.cognome,
        codice_fiscale: utente.codice_fiscale,
        data_nascita: utente.data_nascita,
        sesso: utente.sesso,
        telefono: utente.telefono,
        gruppo_sanguigno: utente.gruppo_sanguigno,
        allergie: utente.allergie,
        patologie: utente.patologie,
        emergenza_nome: utente.emergenza_nome,
        emergenza_telefono: utente.emergenza_telefono,
        device_id: utente.device_id
      }
    })
  } catch (error: any) {
    console.error('❌ Errore login utente:', error)
    return NextResponse.json(
      { success: false, error: 'Errore durante il login', details: error.message },
      { status: 500 }
    )
  }
}
