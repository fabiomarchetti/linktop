import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
})

/**
 * GET /api/dispositivi/[id]
 * Ottiene i dettagli di un dispositivo
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params
    const id = parseInt(idParam)

    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: 'ID non valido' },
        { status: 400 }
      )
    }

    const query = `
      SELECT
        d.*,
        p.nome as paziente_nome,
        p.cognome as paziente_cognome,
        p.telefono as paziente_telefono,
        p.codice_fiscale as paziente_cf
      FROM linktop_dispositivi d
      LEFT JOIN linktop_pazienti p ON d.paziente_id = p.id
      WHERE d.id = $1
    `

    const result = await pool.query(query, [id])

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Dispositivo non trovato' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      dispositivo: result.rows[0]
    })

  } catch (error: any) {
    console.error(`Errore GET /api/dispositivi/[id]:`, error)
    return NextResponse.json(
      {
        success: false,
        error: 'Errore nel caricamento del dispositivo',
        details: error.message
      },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/dispositivi/[id]
 * Aggiorna un dispositivo
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params
    const id = parseInt(idParam)

    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: 'ID non valido' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const {
      device_name,
      device_type,
      manufacturer,
      model,
      firmware_version,
      serial_number,
      battery_level,
      signal_strength,
      connection_status,
      maintenance_notes,
      active
    } = body

    // Verifica che il dispositivo esista
    const checkQuery = 'SELECT id FROM linktop_dispositivi WHERE id = $1'
    const checkResult = await pool.query(checkQuery, [id])

    if (checkResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Dispositivo non trovato' },
        { status: 404 }
      )
    }

    // Costruisci query di update dinamica
    const updates: string[] = []
    const values: any[] = []
    let valueIndex = 1

    if (device_name !== undefined) {
      updates.push(`device_name = $${valueIndex++}`)
      values.push(device_name)
    }
    if (device_type !== undefined) {
      const tipiValidi = ['stetoscopio', 'otoscopio', 'health_monitor']
      if (!tipiValidi.includes(device_type)) {
        return NextResponse.json(
          { success: false, error: `device_type deve essere uno tra: ${tipiValidi.join(', ')}` },
          { status: 400 }
        )
      }
      updates.push(`device_type = $${valueIndex++}`)
      values.push(device_type)
    }
    if (manufacturer !== undefined) {
      updates.push(`manufacturer = $${valueIndex++}`)
      values.push(manufacturer)
    }
    if (model !== undefined) {
      updates.push(`model = $${valueIndex++}`)
      values.push(model)
    }
    if (firmware_version !== undefined) {
      updates.push(`firmware_version = $${valueIndex++}`)
      values.push(firmware_version)
    }
    if (serial_number !== undefined) {
      updates.push(`serial_number = $${valueIndex++}`)
      values.push(serial_number)
    }
    if (battery_level !== undefined) {
      updates.push(`battery_level = $${valueIndex++}`)
      values.push(battery_level)
    }
    if (signal_strength !== undefined) {
      updates.push(`signal_strength = $${valueIndex++}`)
      values.push(signal_strength)
    }
    if (connection_status !== undefined) {
      updates.push(`connection_status = $${valueIndex++}`)
      values.push(connection_status)
    }
    if (connection_status === 'online') {
      updates.push(`last_connection = CURRENT_TIMESTAMP`)
    }
    if (maintenance_notes !== undefined) {
      updates.push(`maintenance_notes = $${valueIndex++}`)
      values.push(maintenance_notes)
    }
    if (active !== undefined) {
      updates.push(`active = $${valueIndex++}`)
      values.push(active)
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Nessun campo da aggiornare' },
        { status: 400 }
      )
    }

    values.push(id) // Aggiungi ID alla fine per WHERE clause

    const updateQuery = `
      UPDATE linktop_dispositivi
      SET ${updates.join(', ')}
      WHERE id = $${valueIndex}
      RETURNING *
    `

    const result = await pool.query(updateQuery, values)

    return NextResponse.json({
      success: true,
      dispositivo: result.rows[0],
      message: 'Dispositivo aggiornato con successo'
    })

  } catch (error: any) {
    console.error(`Errore PUT /api/dispositivi/[id]:`, error)
    return NextResponse.json(
      {
        success: false,
        error: 'Errore nell\'aggiornamento del dispositivo',
        details: error.message
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/dispositivi/[id]
 * Elimina definitivamente un dispositivo
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params
    const id = parseInt(idParam)

    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: 'ID non valido' },
        { status: 400 }
      )
    }

    // Verifica che il dispositivo esista
    const checkQuery = 'SELECT paziente_id, device_name FROM linktop_dispositivi WHERE id = $1'
    const checkResult = await pool.query(checkQuery, [id])

    if (checkResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Dispositivo non trovato' },
        { status: 404 }
      )
    }

    // Verifica se è assegnato
    if (checkResult.rows[0].paziente_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Impossibile eliminare un dispositivo assegnato ad un paziente. Rimuovi prima l\'assegnazione.'
        },
        { status: 409 }
      )
    }

    // Hard delete - elimina definitivamente il record
    const deleteQuery = 'DELETE FROM linktop_dispositivi WHERE id = $1 RETURNING device_name'
    const result = await pool.query(deleteQuery, [id])

    return NextResponse.json({
      success: true,
      message: `Dispositivo "${result.rows[0].device_name}" eliminato definitivamente`,
    })

  } catch (error: any) {
    console.error(`Errore DELETE /api/dispositivi/[id]:`, error)
    return NextResponse.json(
      {
        success: false,
        error: 'Errore nell\'eliminazione del dispositivo',
        details: error.message
      },
      { status: 500 }
    )
  }
}
