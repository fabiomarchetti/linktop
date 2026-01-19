import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

/**
 * GET /api/dispositivi
 * Ottiene la lista di tutti i dispositivi con informazioni sui pazienti assegnati
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tipo = searchParams.get('tipo') // filtro per tipo
    const disponibile = searchParams.get('disponibile') // filtro per disponibilità
    const paziente_id = searchParams.get('paziente_id') // filtro per paziente

    let query = `
      SELECT
        d.*,
        p.nome as paziente_nome,
        p.cognome as paziente_cognome,
        p.telefono as paziente_telefono
      FROM linktop_dispositivi d
      LEFT JOIN linktop_pazienti p ON d.paziente_id = p.id
      WHERE d.active = true
    `
    const params: any[] = []
    let paramCount = 1

    if (tipo) {
      query += ` AND d.device_type = $${paramCount}`
      params.push(tipo)
      paramCount++
    }

    if (disponibile === 'true') {
      query += ` AND d.paziente_id IS NULL`
    } else if (disponibile === 'false') {
      query += ` AND d.paziente_id IS NOT NULL`
    }

    if (paziente_id) {
      query += ` AND d.paziente_id = $${paramCount}`
      params.push(parseInt(paziente_id))
      paramCount++
    }

    query += ` ORDER BY d.device_type, d.device_name`

    const result = await pool.query(query, params)

    return NextResponse.json({
      success: true,
      dispositivi: result.rows
    })
  } catch (error: any) {
    console.error('Errore GET /api/dispositivi:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Errore nel caricamento dei dispositivi',
        details: error.message
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/dispositivi
 * Crea un nuovo dispositivo
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      device_name,
      device_type,
      device_identifier,
      manufacturer,
      model,
      firmware_version,
      serial_number,
      battery_level,
      signal_strength
    } = body

    // Validazione campi obbligatori
    if (!device_name || !device_type || !device_identifier) {
      return NextResponse.json(
        {
          success: false,
          error: 'Campi obbligatori mancanti: device_name, device_type, device_identifier'
        },
        { status: 400 }
      )
    }

    // Validazione device_type
    const tipiValidi = ['stetoscopio', 'otoscopio', 'health_monitor']
    if (!tipiValidi.includes(device_type)) {
      return NextResponse.json(
        {
          success: false,
          error: `device_type deve essere uno tra: ${tipiValidi.join(', ')}`
        },
        { status: 400 }
      )
    }

    // Verifica che l'identifier non esista già
    const checkQuery = `
      SELECT id FROM linktop_dispositivi
      WHERE device_identifier = $1
    `
    const checkResult = await pool.query(checkQuery, [device_identifier])

    if (checkResult.rows.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Esiste già un dispositivo con questo identifier (MAC Address)'
        },
        { status: 409 }
      )
    }

    // Inserimento
    const insertQuery = `
      INSERT INTO linktop_dispositivi (
        device_name, device_type, device_identifier,
        manufacturer, model, firmware_version, serial_number,
        battery_level, signal_strength, connection_status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'offline')
      RETURNING *
    `

    const result = await pool.query(insertQuery, [
      device_name,
      device_type,
      device_identifier,
      manufacturer || null,
      model || null,
      firmware_version || null,
      serial_number || null,
      battery_level || null,
      signal_strength || null
    ])

    return NextResponse.json({
      success: true,
      dispositivo: result.rows[0],
      message: 'Dispositivo creato con successo'
    }, { status: 201 })

  } catch (error: any) {
    console.error('Errore POST /api/dispositivi:', error)

    // Errore constraint unique
    if (error.code === '23505') {
      if (error.constraint === 'linktop_dispositivi_device_identifier_key') {
        return NextResponse.json(
          { success: false, error: 'Dispositivo con questo identifier già esistente' },
          { status: 409 }
        )
      }
      if (error.constraint === 'linktop_dispositivi_serial_number_key') {
        return NextResponse.json(
          { success: false, error: 'Dispositivo con questo serial number già esistente' },
          { status: 409 }
        )
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Errore nella creazione del dispositivo',
        details: error.message
      },
      { status: 500 }
    )
  }
}
