import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

/**
 * POST /api/gps/request-position/[pazienteId]
 * Inserisce un comando in linktop_app_commands.
 * L'app Flutter e' in ascolto via Supabase Realtime e reagisce subito.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ pazienteId: string }> }
) {
  try {
    const { pazienteId } = await params
    const body = await request.json().catch(() => ({}))
    const requestedBy = body.requested_by || 'supervisore'

    const result = await pool.query(
      `INSERT INTO linktop_app_commands (paziente_id, command, status, requested_by)
       VALUES ($1, 'get_position', 'pending', $2)
       RETURNING id, requested_at`,
      [pazienteId, requestedBy]
    )

    return NextResponse.json({
      success: true,
      command_id: result.rows[0].id,
      requested_at: result.rows[0].requested_at,
    }, { status: 201 })
  } catch (error: any) {
    console.error('Errore richiesta posizione:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * GET /api/gps/request-position/[pazienteId]?command_id=X
 * Polling: verifica se il comando e' stato completato
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pazienteId: string }> }
) {
  try {
    const { pazienteId } = await params
    const { searchParams } = new URL(request.url)
    const commandId = searchParams.get('command_id')

    if (!commandId) {
      return NextResponse.json({ success: false, error: 'command_id richiesto' }, { status: 400 })
    }

    const result = await pool.query(
      `SELECT id, status, result, completed_at FROM linktop_app_commands
       WHERE id = $1 AND paziente_id = $2`,
      [commandId, pazienteId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Comando non trovato' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: result.rows[0] })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
