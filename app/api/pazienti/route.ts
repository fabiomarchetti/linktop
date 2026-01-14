import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

/**
 * GET /api/pazienti
 * Recupera tutti i pazienti monitorati con dispositivi LINKTOP
 */
export async function GET(request: NextRequest) {
  try {
    const result = await pool.query(`
      SELECT
        p.id,
        p.nome,
        p.cognome,
        p.data_nascita,
        p.luogo_nascita,
        p.codice_fiscale,
        p.password,
        p.sesso,
        p.telefono,
        p.email,
        p.indirizzo,
        p.citta,
        p.provincia,
        p.cap,
        p.emergenza_nome,
        p.emergenza_telefono,
        p.emergenza_relazione,
        p.emergenza2_nome,
        p.emergenza2_telefono,
        p.emergenza2_relazione,
        p.gruppo_sanguigno,
        p.allergie,
        p.patologie,
        p.farmaci,
        p.note_mediche,
        p.last_heart_rate,
        p.last_heart_rate_time,
        p.last_systolic_bp,
        p.last_diastolic_bp,
        p.last_bp_time,
        p.last_spo2,
        p.last_spo2_time,
        p.last_temperature,
        p.last_temperature_time,
        p.last_otoscope_notes,
        p.last_otoscope_time,
        p.device_id,
        p.foto_url,
        p.active,
        p.created_at,
        p.updated_at
      FROM linktop_pazienti p
      WHERE p.active = true
      ORDER BY p.cognome, p.nome
    `)

    return NextResponse.json({
      success: true,
      pazienti: result.rows,
      total: result.rows.length
    })
  } catch (error: any) {
    console.error('❌ Errore recupero pazienti LINKTOP:', error)
    return NextResponse.json(
      { error: 'Errore recupero pazienti', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/pazienti
 * Crea un nuovo paziente
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      nome,
      cognome,
      data_nascita,
      luogo_nascita,
      codice_fiscale,
      password,
      sesso,
      telefono,
      email,
      indirizzo,
      citta,
      provincia,
      cap,
      emergenza_nome,
      emergenza_telefono,
      emergenza_relazione,
      emergenza2_nome,
      emergenza2_telefono,
      emergenza2_relazione,
      gruppo_sanguigno,
      allergie,
      patologie,
      farmaci,
      note_mediche,
      device_id
    } = body

    if (!nome || !cognome) {
      return NextResponse.json(
        { error: 'Nome e cognome sono obbligatori' },
        { status: 400 }
      )
    }

    // Verifica codice fiscale univoco
    if (codice_fiscale) {
      const checkCF = await pool.query(
        'SELECT id FROM linktop_pazienti WHERE codice_fiscale = $1',
        [codice_fiscale]
      )
      if (checkCF.rows.length > 0) {
        return NextResponse.json(
          { error: 'Codice fiscale già esistente' },
          { status: 409 }
        )
      }
    }

    const result = await pool.query(
      `INSERT INTO linktop_pazienti (
        nome, cognome, data_nascita, luogo_nascita, codice_fiscale, password, sesso,
        telefono, email, indirizzo, citta, provincia, cap,
        emergenza_nome, emergenza_telefono, emergenza_relazione,
        emergenza2_nome, emergenza2_telefono, emergenza2_relazione,
        gruppo_sanguigno, allergie, patologie, farmaci, note_mediche,
        device_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
      RETURNING *`,
      [
        nome, cognome, data_nascita, luogo_nascita, codice_fiscale, password, sesso,
        telefono, email, indirizzo, citta, provincia, cap,
        emergenza_nome, emergenza_telefono, emergenza_relazione,
        emergenza2_nome, emergenza2_telefono, emergenza2_relazione,
        gruppo_sanguigno, allergie, patologie, farmaci, note_mediche,
        device_id || null
      ]
    )

    return NextResponse.json({
      success: true,
      message: 'Paziente creato con successo',
      paziente: result.rows[0]
    }, { status: 201 })
  } catch (error: any) {
    console.error('❌ Errore creazione paziente LINKTOP:', error)
    return NextResponse.json(
      { error: 'Errore creazione paziente', details: error.message },
      { status: 500 }
    )
  }
}
