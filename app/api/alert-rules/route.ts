import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { invalidateGlobalRulesCache } from '@/lib/alerts'

/**
 * GET /api/alert-rules
 * Recupera le regole di alert
 *
 * Query params:
 * - paziente_id: se specificato, ritorna le regole per quel paziente
 * - include_global: 'true' per includere anche le regole globali (default: true)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const pazienteId = searchParams.get('paziente_id')
    const includeGlobal = searchParams.get('include_global') !== 'false'

    // Recupera regole globali
    let globalRules: any[] = []
    if (includeGlobal) {
      const globalResult = await pool.query(`
        SELECT
          id,
          paziente_id,
          parameter_type,
          min_warning,
          max_warning,
          min_critical,
          max_critical,
          enabled,
          priority,
          created_at,
          updated_at
        FROM linktop_alert_rules
        WHERE paziente_id IS NULL
        ORDER BY
          CASE parameter_type
            WHEN 'heart_rate' THEN 1
            WHEN 'spo2' THEN 2
            WHEN 'systolic_bp' THEN 3
            WHEN 'diastolic_bp' THEN 4
            WHEN 'temperature' THEN 5
          END
      `)
      globalRules = globalResult.rows
    }

    // Recupera regole specifiche paziente (se richiesto)
    let patientRules: any[] = []
    if (pazienteId) {
      const patientResult = await pool.query(`
        SELECT
          id,
          paziente_id,
          parameter_type,
          min_warning,
          max_warning,
          min_critical,
          max_critical,
          enabled,
          priority,
          created_at,
          updated_at
        FROM linktop_alert_rules
        WHERE paziente_id = $1
        ORDER BY
          CASE parameter_type
            WHEN 'heart_rate' THEN 1
            WHEN 'spo2' THEN 2
            WHEN 'systolic_bp' THEN 3
            WHEN 'diastolic_bp' THEN 4
            WHEN 'temperature' THEN 5
          END
      `, [parseInt(pazienteId)])
      patientRules = patientResult.rows
    }

    return NextResponse.json({
      success: true,
      global_rules: globalRules,
      patient_rules: patientRules,
    })

  } catch (error: any) {
    console.error('Errore GET /api/alert-rules:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/alert-rules
 * Crea o aggiorna una regola di alert
 *
 * Body:
 * - paziente_id: null per regola globale, ID per regola specifica
 * - parameter_type: 'heart_rate' | 'spo2' | 'systolic_bp' | 'diastolic_bp' | 'temperature'
 * - min_warning, max_warning, min_critical, max_critical: valori soglia
 * - enabled: boolean
 * - priority: 1-10
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      paziente_id,
      parameter_type,
      min_warning,
      max_warning,
      min_critical,
      max_critical,
      enabled = true,
      priority = 5,
    } = body

    if (!parameter_type) {
      return NextResponse.json(
        { error: 'parameter_type richiesto' },
        { status: 400 }
      )
    }

    // Verifica se esiste già una regola per questo paziente/parametro
    const existingResult = await pool.query(`
      SELECT id FROM linktop_alert_rules
      WHERE parameter_type = $1
        AND (
          (paziente_id IS NULL AND $2::integer IS NULL) OR
          (paziente_id = $2)
        )
    `, [parameter_type, paziente_id])

    let result
    if (existingResult.rows.length > 0) {
      // Aggiorna regola esistente
      result = await pool.query(`
        UPDATE linktop_alert_rules
        SET
          min_warning = $1,
          max_warning = $2,
          min_critical = $3,
          max_critical = $4,
          enabled = $5,
          priority = $6,
          updated_at = NOW()
        WHERE id = $7
        RETURNING *
      `, [
        min_warning,
        max_warning,
        min_critical,
        max_critical,
        enabled,
        priority,
        existingResult.rows[0].id,
      ])
    } else {
      // Crea nuova regola
      result = await pool.query(`
        INSERT INTO linktop_alert_rules (
          paziente_id,
          parameter_type,
          min_warning,
          max_warning,
          min_critical,
          max_critical,
          enabled,
          priority
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [
        paziente_id,
        parameter_type,
        min_warning,
        max_warning,
        min_critical,
        max_critical,
        enabled,
        priority,
      ])
    }

    // Invalida cache se è una regola globale
    if (paziente_id === null) {
      invalidateGlobalRulesCache()
    }

    return NextResponse.json({
      success: true,
      rule: result.rows[0],
    })

  } catch (error: any) {
    console.error('Errore POST /api/alert-rules:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/alert-rules
 * Elimina una regola specifica per paziente (non le globali)
 *
 * Query params:
 * - id: ID della regola da eliminare
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'id richiesto' },
        { status: 400 }
      )
    }

    // Verifica che non sia una regola globale
    const checkResult = await pool.query(`
      SELECT paziente_id FROM linktop_alert_rules WHERE id = $1
    `, [parseInt(id)])

    if (checkResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Regola non trovata' },
        { status: 404 }
      )
    }

    if (checkResult.rows[0].paziente_id === null) {
      return NextResponse.json(
        { error: 'Non è possibile eliminare le regole globali' },
        { status: 400 }
      )
    }

    await pool.query(`
      DELETE FROM linktop_alert_rules WHERE id = $1
    `, [parseInt(id)])

    return NextResponse.json({
      success: true,
      message: 'Regola eliminata',
    })

  } catch (error: any) {
    console.error('Errore DELETE /api/alert-rules:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
