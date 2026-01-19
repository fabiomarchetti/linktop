import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

/**
 * GET /api/dashboard/stats
 * Restituisce le statistiche per la dashboard
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Conta pazienti attivi
    const pazientiResult = await pool.query(
      `SELECT COUNT(*) as count
       FROM linktop_pazienti
       WHERE active = true`
    )
    const pazientiTotali = parseInt(pazientiResult.rows[0].count)

    // 2. Conta dispositivi attivi
    const dispositiviResult = await pool.query(
      `SELECT COUNT(*) as count
       FROM linktop_dispositivi
       WHERE active = true`
    )
    const dispositiviAttivi = parseInt(dispositiviResult.rows[0].count)

    // 3. Conta misurazioni di oggi
    const oggi = new Date()
    oggi.setHours(0, 0, 0, 0)
    const misurazioniResult = await pool.query(
      `SELECT COUNT(*) as count
       FROM linktop_health_data
       WHERE recorded_at >= $1`,
      [oggi]
    )
    const misurazioniOggi = parseInt(misurazioniResult.rows[0].count)

    // 4. Conta alert attivi (valori fuori range nelle ultime 24 ore)
    const ieri = new Date()
    ieri.setHours(ieri.getHours() - 24)

    const alertResult = await pool.query(
      `SELECT COUNT(*) as count
       FROM linktop_health_data
       WHERE recorded_at >= $1
       AND (
         (heart_rate IS NOT NULL AND (heart_rate < 60 OR heart_rate > 100)) OR
         (spo2 IS NOT NULL AND spo2 < 95) OR
         (systolic_bp IS NOT NULL AND (systolic_bp < 90 OR systolic_bp > 140)) OR
         (diastolic_bp IS NOT NULL AND (diastolic_bp < 60 OR diastolic_bp > 90)) OR
         (temperature IS NOT NULL AND (temperature < 36 OR temperature > 37.5))
       )`,
      [ieri]
    )
    const alertAttivi = parseInt(alertResult.rows[0].count)

    return NextResponse.json({
      success: true,
      stats: {
        pazienti_totali: pazientiTotali,
        dispositivi_attivi: dispositiviAttivi,
        misurazioni_oggi: misurazioniOggi,
        alert_attivi: alertAttivi
      }
    })
  } catch (error: any) {
    console.error('Errore GET /api/dashboard/stats:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Errore nel caricamento delle statistiche',
        details: error.message
      },
      { status: 500 }
    )
  }
}
