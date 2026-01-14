import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    // Recupera tutti i ruoli LINKTOP ordinati per livello (dal più alto al più basso)
    const result = await pool.query(
      `SELECT id, nome_ruolo, descrizione, livello_accesso
       FROM linktop_ruoli
       ORDER BY livello_accesso DESC`
    )

    return NextResponse.json(
      {
        ruoli: result.rows.map(r => ({
          id: r.id,
          nome: r.nome_ruolo,
          descrizione: r.descrizione,
          livello: r.livello_accesso,
        })),
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('❌ Errore durante il recupero dei ruoli LINKTOP:', error)
    return NextResponse.json(
      { error: 'Errore del server' },
      { status: 500 }
    )
  }
}
