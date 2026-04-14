import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

/**
 * POST /api/health/request-ring/[id]
 * Inserisce un comando `misura_anello` in linktop_app_commands.
 * L'app Flutter e' in ascolto via Supabase Realtime e reagisce subito.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const result = await pool.query(
      `INSERT INTO linktop_app_commands (paziente_id, command, status)
       VALUES ($1, 'misura_anello', 'pending')
       RETURNING id, requested_at`,
      [id]
    )

    return NextResponse.json({
      success: true,
      command_id: result.rows[0].id,
      requested_at: result.rows[0].requested_at,
    }, { status: 201 })
  } catch (error: any) {
    console.error('Errore richiesta misura anello:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * GET /api/health/request-ring/[id]?command_id=X
 * Polling: verifica se il comando e' stato completato.
 * Ritorna { success: true, data: { status, result } }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const commandId = searchParams.get('command_id')

    if (!commandId) {
      return NextResponse.json({ success: false, error: 'command_id richiesto' }, { status: 400 })
    }

    const result = await pool.query(
      `SELECT id, status, result, completed_at FROM linktop_app_commands
       WHERE id = $1 AND paziente_id = $2`,
      [commandId, id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Comando non trovato' }, { status: 404 })
    }

    const row = result.rows[0]

    return NextResponse.json({
      success: true,
      data: {
        status: row.status,
        result: row.status === 'completed' ? row.result : null,
      },
    })
  } catch (error: any) {
    console.error('Errore polling misura anello:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
