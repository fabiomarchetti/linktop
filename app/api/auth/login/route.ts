import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, password } = body

    // Validazione input
    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username e password sono obbligatori' },
        { status: 400 }
      )
    }

    // Query su linktop_users (NON users GPS!)
    const result = await pool.query(
      `SELECT
        u.id,
        u.nome,
        u.cognome,
        u.username,
        u.email,
        u.password,
        u.ruolo,
        u.ruolo_id,
        u.active,
        r.nome_ruolo,
        r.descrizione as ruolo_descrizione,
        r.livello_accesso
       FROM linktop_users u
       LEFT JOIN linktop_ruoli r ON r.id = u.ruolo_id
       WHERE u.username = $1`,
      [username]
    )

    // Utente non trovato
    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Credenziali non valide' },
        { status: 401 }
      )
    }

    const user = result.rows[0]

    // Verifica se utente è attivo
    if (!user.active) {
      return NextResponse.json(
        { error: 'Account disabilitato. Contatta l\'amministratore.' },
        { status: 403 }
      )
    }

    // Verifica password (in chiaro, come GPS)
    if (password !== user.password) {
      return NextResponse.json(
        { error: 'Credenziali non valide' },
        { status: 401 }
      )
    }

    // Rimuovi password dalla risposta
    const { password: _, ...userWithoutPassword } = user

    // Aggiungi dettagli ruolo
    const userData = {
      ...userWithoutPassword,
      ruoloDettaglio: {
        id: user.ruolo_id,
        nome: user.nome_ruolo,
        descrizione: user.ruolo_descrizione,
        livello_accesso: user.livello_accesso,
      },
    }

    // Login riuscito
    return NextResponse.json(
      {
        success: true,
        message: 'Login effettuato con successo',
        user: userData,
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('❌ Errore login LINKTOP:', error)
    return NextResponse.json(
      {
        error: 'Errore del server durante il login',
        details: error.message
      },
      { status: 500 }
    )
  }
}
