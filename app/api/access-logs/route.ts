import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    // Verifica autenticazione (in un'app reale, usa il token JWT o session)
    // Per ora, assumiamo che l'utente sia passato come parametro

    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('user_id')
    const actionType = searchParams.get('action_type')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Costruisci query dinamica
    let sql = `
      SELECT
        id,
        user_id,
        username,
        nome,
        cognome,
        ruolo,
        action_type,
        page_url,
        ip_address,
        user_agent,
        created_at
      FROM linktop_access_logs
      WHERE 1=1
    `

    const params: any[] = []
    let paramIndex = 1

    // Filtro per user_id
    if (userId) {
      sql += ` AND user_id = $${paramIndex}`
      params.push(parseInt(userId))
      paramIndex++
    }

    // Filtro per action_type
    if (actionType) {
      sql += ` AND action_type = $${paramIndex}`
      params.push(actionType)
      paramIndex++
    }

    // Ordinamento e paginazione
    sql += ` ORDER BY created_at DESC`
    sql += ` LIMIT $${paramIndex}`
    params.push(limit)
    paramIndex++

    sql += ` OFFSET $${paramIndex}`
    params.push(offset)

    const result = await pool.query(sql, params)

    // Conta totale per paginazione
    let countSql = 'SELECT COUNT(*) FROM linktop_access_logs WHERE 1=1'
    const countParams: any[] = []
    let countParamIndex = 1

    if (userId) {
      countSql += ` AND user_id = $${countParamIndex}`
      countParams.push(parseInt(userId))
      countParamIndex++
    }

    if (actionType) {
      countSql += ` AND action_type = $${countParamIndex}`
      countParams.push(actionType)
    }

    const countResult = await pool.query(countSql, countParams)
    const total = parseInt(countResult.rows[0].count)

    return NextResponse.json({
      success: true,
      logs: result.rows,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + result.rows.length < total
      }
    })

  } catch (error) {
    console.error('Errore recupero access logs:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Errore nel recupero dei log',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// POST: Crea un nuovo log
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { user_id, username, nome, cognome, ruolo, action_type, page_url, ip_address, user_agent } = body

    // Validazione
    if (!user_id || !username || !action_type) {
      return NextResponse.json(
        { success: false, error: 'Campi obbligatori mancanti' },
        { status: 400 }
      )
    }

    if (!['login', 'logout', 'page_visit'].includes(action_type)) {
      return NextResponse.json(
        { success: false, error: 'action_type non valido' },
        { status: 400 }
      )
    }

    const sql = `
      INSERT INTO linktop_access_logs
        (user_id, username, nome, cognome, ruolo, action_type, page_url, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `

    const result = await pool.query(sql, [
      user_id,
      username,
      nome,
      cognome,
      ruolo,
      action_type,
      page_url,
      ip_address,
      user_agent
    ])

    return NextResponse.json({
      success: true,
      log: result.rows[0]
    })

  } catch (error) {
    console.error('Errore creazione access log:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Errore nella creazione del log',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
