import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

/**
 * GET /api/ruoli
 * Restituisce tutti i ruoli disponibili nel sistema
 */
export async function GET(request: NextRequest) {
  try {
    const result = await pool.query(`
      SELECT id, nome_ruolo as nome, descrizione, livello_accesso as livello
      FROM linktop_ruoli
      ORDER BY livello_accesso DESC
    `)

    return NextResponse.json({
      success: true,
      ruoli: result.rows
    })
  } catch (error: any) {
    console.error('Errore GET /api/ruoli:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Errore nel caricamento dei ruoli',
        details: error.message
      },
      { status: 500 }
    )
  }
}
