import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

/**
 * GET /api/geofences/[pazienteId]
 * Ritorna tutte le geofence attive del paziente
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pazienteId: string }> }
) {
  try {
    const { pazienteId } = await params

    const result = await pool.query(
      `SELECT id, name, center_lat, center_lng, radius_meters, type, active,
              notify_on_exit, notify_on_enter, created_at
       FROM linktop_geofences
       WHERE paziente_id = $1
       ORDER BY created_at DESC`,
      [pazienteId]
    )

    return NextResponse.json({ success: true, data: result.rows })
  } catch (error: any) {
    console.error('Errore GET geofences:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/geofences/[pazienteId]
 * Crea una nuova geofence (cerchio)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ pazienteId: string }> }
) {
  try {
    const { pazienteId } = await params
    const body = await request.json()
    const { name, center_lat, center_lng, radius_meters, type, created_by } = body

    if (!name || center_lat === undefined || center_lng === undefined || !radius_meters) {
      return NextResponse.json(
        { success: false, error: 'name, center_lat, center_lng, radius_meters richiesti' },
        { status: 400 }
      )
    }

    const result = await pool.query(
      `INSERT INTO linktop_geofences
       (paziente_id, name, center_lat, center_lng, radius_meters, type, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [pazienteId, name, center_lat, center_lng, radius_meters, type || 'safe', created_by || null]
    )

    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 })
  } catch (error: any) {
    console.error('Errore POST geofence:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/geofences/[pazienteId]?id=X
 * Elimina una geofence
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ pazienteId: string }> }
) {
  try {
    const { pazienteId } = await params
    const { searchParams } = new URL(request.url)
    const geofenceId = searchParams.get('id')

    if (!geofenceId) {
      return NextResponse.json({ success: false, error: 'id richiesto' }, { status: 400 })
    }

    await pool.query(
      `DELETE FROM linktop_geofences WHERE id = $1 AND paziente_id = $2`,
      [geofenceId, pazienteId]
    )

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
