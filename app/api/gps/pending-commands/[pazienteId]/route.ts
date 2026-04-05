import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

/**
 * GET /api/gps/pending-commands/[pazienteId]
 * Ritorna i comandi pending per il paziente (usato dall'app Flutter per polling)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pazienteId: string }> }
) {
  try {
    const { pazienteId } = await params

    const result = await pool.query(
      `SELECT id, command, payload, requested_at
       FROM linktop_app_commands
       WHERE paziente_id = $1 AND status = 'pending'
       ORDER BY requested_at ASC
       LIMIT 5`,
      [pazienteId]
    )

    return NextResponse.json({ success: true, data: result.rows })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/gps/pending-commands/[pazienteId]
 * L'app segnala il completamento di un comando
 * Body: { command_id, result, error }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ pazienteId: string }> }
) {
  try {
    const { pazienteId } = await params
    const body = await request.json()
    const { command_id, result, error } = body

    if (!command_id) {
      return NextResponse.json({ success: false, error: 'command_id richiesto' }, { status: 400 })
    }

    await pool.query(
      `UPDATE linktop_app_commands
       SET status = $1, result = $2, completed_at = NOW()
       WHERE id = $3 AND paziente_id = $4`,
      [error ? 'failed' : 'completed', error ? { error } : result, command_id, pazienteId]
    )

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e.message },
      { status: 500 }
    )
  }
}
