import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

/**
 * GET /api/health-data
 * Recupera i dati storici delle misurazioni
 * Query params:
 * - type: 'spo2' | 'heart_rate' | 'temperature' | 'blood_pressure'
 * - paziente_id: opzionale, filtra per paziente
 * - limit: numero di record (default 100)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const paziente_id = searchParams.get('paziente_id')
    const limit = parseInt(searchParams.get('limit') || '100')

    if (!type) {
      return NextResponse.json(
        { error: 'Parametro type richiesto' },
        { status: 400 }
      )
    }

    let query = `
      SELECT
        hd.id,
        hd.paziente_id,
        hd.measurement_type,
        hd.heart_rate,
        hd.systolic_bp,
        hd.diastolic_bp,
        hd.spo2,
        hd.temperature,
        hd.recorded_at,
        p.nome,
        p.cognome,
        p.codice_fiscale
      FROM linktop_health_data hd
      JOIN linktop_pazienti p ON hd.paziente_id = p.id
      WHERE hd.measurement_type = $1
    `

    const params: any[] = [type]
    let paramCount = 2

    if (paziente_id) {
      query += ` AND hd.paziente_id = $${paramCount}`
      params.push(parseInt(paziente_id))
      paramCount++
    }

    query += ` ORDER BY hd.recorded_at DESC LIMIT $${paramCount}`
    params.push(limit)

    const result = await pool.query(query, params)

    // Calcola statistiche
    let stats = null
    if (result.rows.length > 0) {
      let values: number[] = []

      if (type === 'spo2') {
        values = result.rows.map(r => r.spo2).filter(v => v !== null)
      } else if (type === 'heart_rate') {
        values = result.rows.map(r => r.heart_rate).filter(v => v !== null)
      } else if (type === 'temperature') {
        values = result.rows.map(r => parseFloat(r.temperature)).filter(v => !isNaN(v))
      } else if (type === 'blood_pressure') {
        const systolicValues = result.rows.map(r => r.systolic_bp).filter(v => v !== null)
        const diastolicValues = result.rows.map(r => r.diastolic_bp).filter(v => v !== null)

        stats = {
          systolic: {
            min: Math.min(...systolicValues),
            max: Math.max(...systolicValues),
            avg: (systolicValues.reduce((a, b) => a + b, 0) / systolicValues.length).toFixed(1)
          },
          diastolic: {
            min: Math.min(...diastolicValues),
            max: Math.max(...diastolicValues),
            avg: (diastolicValues.reduce((a, b) => a + b, 0) / diastolicValues.length).toFixed(1)
          }
        }
      }

      if (type !== 'blood_pressure' && values.length > 0) {
        stats = {
          min: Math.min(...values),
          max: Math.max(...values),
          avg: type === 'temperature'
            ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1)
            : Math.round(values.reduce((a, b) => a + b, 0) / values.length)
        }
      }
    }

    return NextResponse.json({
      success: true,
      type,
      data: result.rows,
      total: result.rows.length,
      stats
    })
  } catch (error: any) {
    console.error('Errore GET /api/health-data:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Errore nel caricamento dei dati',
        details: error.message
      },
      { status: 500 }
    )
  }
}
