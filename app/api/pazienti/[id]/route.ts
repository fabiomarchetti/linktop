import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

/**
 * GET /api/pazienti/[id]
 * Recupera un singolo paziente LINKTOP
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const result = await pool.query(`
      SELECT *
      FROM linktop_pazienti
      WHERE id = $1
    `, [id])

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Paziente non trovato' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      paziente: result.rows[0]
    })
  } catch (error: any) {
    console.error('❌ Errore recupero paziente LINKTOP:', error)
    return NextResponse.json(
      { error: 'Errore recupero paziente', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/pazienti/[id]
 * Aggiorna un paziente LINKTOP
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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
      device_id,
      active
    } = body

    if (!nome || !cognome) {
      return NextResponse.json(
        { error: 'Nome e cognome sono obbligatori' },
        { status: 400 }
      )
    }

    // Verifica codice fiscale univoco (escludendo paziente corrente)
    if (codice_fiscale) {
      const checkCF = await pool.query(
        'SELECT id FROM linktop_pazienti WHERE codice_fiscale = $1 AND id != $2',
        [codice_fiscale, id]
      )
      if (checkCF.rows.length > 0) {
        return NextResponse.json(
          { error: 'Codice fiscale già esistente' },
          { status: 409 }
        )
      }
    }

    const result = await pool.query(
      `UPDATE linktop_pazienti SET
        nome = $1,
        cognome = $2,
        data_nascita = $3,
        luogo_nascita = $4,
        codice_fiscale = $5,
        password = $6,
        sesso = $7,
        telefono = $8,
        email = $9,
        indirizzo = $10,
        citta = $11,
        provincia = $12,
        cap = $13,
        emergenza_nome = $14,
        emergenza_telefono = $15,
        emergenza_relazione = $16,
        emergenza2_nome = $17,
        emergenza2_telefono = $18,
        emergenza2_relazione = $19,
        gruppo_sanguigno = $20,
        allergie = $21,
        patologie = $22,
        farmaci = $23,
        note_mediche = $24,
        device_id = $25,
        active = COALESCE($26, active)
      WHERE id = $27
      RETURNING *`,
      [
        nome,
        cognome,
        data_nascita || null,
        luogo_nascita || null,
        codice_fiscale || null,
        password || null,
        sesso || null,
        telefono || null,
        email || null,
        indirizzo || null,
        citta || null,
        provincia || null,
        cap || null,
        emergenza_nome || null,
        emergenza_telefono || null,
        emergenza_relazione || null,
        emergenza2_nome || null,
        emergenza2_telefono || null,
        emergenza2_relazione || null,
        gruppo_sanguigno || null,
        allergie || null,
        patologie || null,
        farmaci || null,
        note_mediche || null,
        device_id || null,
        active,
        id
      ]
    )

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Paziente non trovato' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Paziente aggiornato con successo',
      paziente: result.rows[0]
    })
  } catch (error: any) {
    console.error('❌ Errore aggiornamento paziente LINKTOP:', error)
    return NextResponse.json(
      { error: 'Errore aggiornamento paziente', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/pazienti/[id]
 * Aggiorna parzialmente un paziente (es. solo la foto)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { foto_url } = body

    if (foto_url !== undefined) {
      const result = await pool.query(
        `UPDATE linktop_pazienti SET foto_url = $1 WHERE id = $2 RETURNING *`,
        [foto_url, id]
      )

      if (result.rows.length === 0) {
        return NextResponse.json(
          { error: 'Paziente non trovato' },
          { status: 404 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Foto aggiornata con successo',
        paziente: result.rows[0]
      })
    }

    return NextResponse.json(
      { error: 'Nessun campo da aggiornare' },
      { status: 400 }
    )
  } catch (error: any) {
    console.error('❌ Errore aggiornamento parziale LINKTOP:', error)
    return NextResponse.json(
      { error: 'Errore aggiornamento', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/pazienti/[id]
 * Elimina un paziente (soft delete - imposta active = false)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Soft delete - imposta active = false
    const result = await pool.query(
      `UPDATE linktop_pazienti SET active = false WHERE id = $1 RETURNING id`,
      [id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Paziente non trovato' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Paziente eliminato con successo'
    })
  } catch (error: any) {
    console.error('❌ Errore eliminazione paziente LINKTOP:', error)
    return NextResponse.json(
      { error: 'Errore eliminazione paziente', details: error.message },
      { status: 500 }
    )
  }
}
