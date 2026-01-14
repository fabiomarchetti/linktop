import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
})

/**
 * POST /api/dispositivi/[id]/assign
 * Assegna un dispositivo ad un paziente
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params
    const dispositivoId = parseInt(idParam)

    if (isNaN(dispositivoId)) {
      return NextResponse.json(
        { success: false, error: 'ID dispositivo non valido' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { paziente_id } = body

    if (!paziente_id) {
      return NextResponse.json(
        { success: false, error: 'paziente_id è obbligatorio' },
        { status: 400 }
      )
    }

    // Verifica che il dispositivo esista e sia disponibile
    const checkDeviceQuery = `
      SELECT id, device_type, paziente_id, device_name
      FROM linktop_dispositivi
      WHERE id = $1 AND active = true
    `
    const deviceResult = await pool.query(checkDeviceQuery, [dispositivoId])

    if (deviceResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Dispositivo non trovato o non attivo' },
        { status: 404 }
      )
    }

    const dispositivo = deviceResult.rows[0]

    if (dispositivo.paziente_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Dispositivo già assegnato ad un altro paziente'
        },
        { status: 409 }
      )
    }

    // Verifica che il paziente esista
    const checkPatientQuery = `
      SELECT id, nome, cognome
      FROM linktop_pazienti
      WHERE id = $1 AND active = true
    `
    const patientResult = await pool.query(checkPatientQuery, [paziente_id])

    if (patientResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Paziente non trovato o non attivo' },
        { status: 404 }
      )
    }

    const paziente = patientResult.rows[0]

    // Verifica che il paziente non abbia già un dispositivo dello stesso tipo
    const checkExistingQuery = `
      SELECT id, device_name
      FROM linktop_dispositivi
      WHERE paziente_id = $1 AND device_type = $2 AND active = true
    `
    const existingResult = await pool.query(checkExistingQuery, [
      paziente_id,
      dispositivo.device_type
    ])

    if (existingResult.rows.length > 0) {
      const tipoLabel =
        dispositivo.device_type === 'stetoscopio' ? 'Stetoscopio' :
        dispositivo.device_type === 'otoscopio' ? 'Otoscopio' :
        'Health Monitor'

      return NextResponse.json(
        {
          success: false,
          error: `Il paziente ha già un ${tipoLabel} assegnato (${existingResult.rows[0].device_name})`
        },
        { status: 409 }
      )
    }

    // Assegna il dispositivo
    const assignQuery = `
      UPDATE linktop_dispositivi
      SET
        paziente_id = $1,
        assigned_date = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `

    const result = await pool.query(assignQuery, [paziente_id, dispositivoId])

    return NextResponse.json({
      success: true,
      message: `${dispositivo.device_name} assegnato con successo a ${paziente.nome} ${paziente.cognome}`,
      dispositivo: result.rows[0]
    })

  } catch (error: any) {
    console.error(`Errore POST /api/dispositivi/[id]/assign:`, error)
    return NextResponse.json(
      {
        success: false,
        error: 'Errore nell\'assegnazione del dispositivo',
        details: error.message
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/dispositivi/[id]/assign
 * Rimuove l'assegnazione di un dispositivo da un paziente
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params
    const dispositivoId = parseInt(idParam)

    if (isNaN(dispositivoId)) {
      return NextResponse.json(
        { success: false, error: 'ID dispositivo non valido' },
        { status: 400 }
      )
    }

    // Verifica che il dispositivo esista e sia assegnato
    const checkQuery = `
      SELECT id, device_name, paziente_id
      FROM linktop_dispositivi
      WHERE id = $1 AND active = true
    `
    const checkResult = await pool.query(checkQuery, [dispositivoId])

    if (checkResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Dispositivo non trovato o non attivo' },
        { status: 404 }
      )
    }

    const dispositivo = checkResult.rows[0]

    if (!dispositivo.paziente_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Il dispositivo non è assegnato a nessun paziente'
        },
        { status: 409 }
      )
    }

    // Rimuovi assegnazione
    const unassignQuery = `
      UPDATE linktop_dispositivi
      SET
        paziente_id = NULL,
        assigned_date = NULL
      WHERE id = $1
      RETURNING *
    `

    const result = await pool.query(unassignQuery, [dispositivoId])

    return NextResponse.json({
      success: true,
      message: `Assegnazione rimossa con successo per ${dispositivo.device_name}`,
      dispositivo: result.rows[0]
    })

  } catch (error: any) {
    console.error(`Errore DELETE /api/dispositivi/[id]/assign:`, error)
    return NextResponse.json(
      {
        success: false,
        error: 'Errore nella rimozione dell\'assegnazione',
        details: error.message
      },
      { status: 500 }
    )
  }
}
