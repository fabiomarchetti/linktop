import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
})

/**
 * POST /api/dispositivi/scan
 * Registra automaticamente un dispositivo scoperto via Bluetooth
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      device_identifier,  // MAC Address BLE
      device_name,        // Nome dal Bluetooth
      device_type         // Tipo dedotto dal nome o dall'utente
    } = body

    // Validazione
    if (!device_identifier || !device_type) {
      return NextResponse.json(
        {
          success: false,
          error: 'MAC Address e tipo dispositivo sono obbligatori'
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

    // Verifica se il dispositivo esiste già
    const checkQuery = `
      SELECT id, paziente_id, device_name
      FROM linktop_dispositivi
      WHERE device_identifier = $1
    `
    const checkResult = await pool.query(checkQuery, [device_identifier])

    // Se esiste già, restituisci quello esistente
    if (checkResult.rows.length > 0) {
      return NextResponse.json({
        success: true,
        dispositivo: checkResult.rows[0],
        message: 'Dispositivo già registrato',
        already_exists: true
      })
    }

    // Genera un nome automatico se non fornito
    const nomeAutomatico = device_name || generateDeviceName(device_type, device_identifier)

    // Manufacturer e model basati sul tipo
    const deviceInfo = getDeviceInfo(device_type)

    // Inserisci il nuovo dispositivo
    const insertQuery = `
      INSERT INTO linktop_dispositivi (
        device_name,
        device_type,
        device_identifier,
        manufacturer,
        model,
        connection_status,
        active
      )
      VALUES ($1, $2, $3, $4, $5, 'online', true)
      RETURNING *
    `

    const result = await pool.query(insertQuery, [
      nomeAutomatico,
      device_type,
      device_identifier,
      deviceInfo.manufacturer,
      deviceInfo.model
    ])

    return NextResponse.json({
      success: true,
      dispositivo: result.rows[0],
      message: 'Dispositivo registrato con successo',
      already_exists: false
    }, { status: 201 })

  } catch (error: any) {
    console.error('Errore POST /api/dispositivi/scan:', error)

    // Errore constraint unique (non dovrebbe succedere per via del check)
    if (error.code === '23505') {
      return NextResponse.json(
        { success: false, error: 'Dispositivo già registrato' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Errore nella registrazione del dispositivo',
        details: error.message
      },
      { status: 500 }
    )
  }
}

/**
 * Genera un nome dispositivo automatico
 */
function generateDeviceName(deviceType: string, macAddress: string): string {
  // Usa le ultime 4 cifre del MAC per rendere il nome univoco
  const shortMac = macAddress.slice(-5).replace(':', '')

  const prefixes: { [key: string]: string } = {
    'stetoscopio': 'Stetoscopio',
    'otoscopio': 'Otoscopio',
    'health_monitor': 'Health Monitor'
  }

  return `${prefixes[deviceType]} ${shortMac.toUpperCase()}`
}

/**
 * Restituisce info produttore e modello per tipo dispositivo
 */
function getDeviceInfo(deviceType: string): { manufacturer: string, model: string } {
  const deviceInfoMap: { [key: string]: { manufacturer: string, model: string } } = {
    'stetoscopio': {
      manufacturer: 'LINKTOP Medical',
      model: 'Digital Stethoscope BLE'
    },
    'otoscopio': {
      manufacturer: 'LINKTOP Medical',
      model: 'Digital Otoscope BLE'
    },
    'health_monitor': {
      manufacturer: 'LINKTOP Medical',
      model: '6-in-1 Health Monitor BLE'
    }
  }

  return deviceInfoMap[deviceType] || { manufacturer: 'LINKTOP', model: 'Unknown' }
}
