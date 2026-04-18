import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import * as crypto from 'crypto';

const pool = new Pool({ connectionString: process.env.LINKTOP_DB_URL, max: 1 });

const JAAS_APP_ID = process.env.JAAS_APP_ID!;
const JAAS_KEY_ID = process.env.JAAS_KEY_ID!;
const JAAS_PRIVATE_KEY = (process.env.JAAS_PRIVATE_KEY ?? '').replace(/\\n/g, '\n');

function base64url(data: string | Buffer): string {
  const buf = typeof data === 'string' ? Buffer.from(data) : data;
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function generateJWT(roomName: string, displayName: string, isModerator: boolean): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', kid: JAAS_KEY_ID, typ: 'JWT' };
  const payload = {
    aud: 'jitsi',
    iss: 'chat',
    iat: now,
    exp: now + 7200,
    nbf: now - 10,
    sub: JAAS_APP_ID,
    room: roomName,
    context: {
      user: { name: displayName, moderator: isModerator },
      features: { livestreaming: false, recording: false },
    },
  };

  const signingInput =
    base64url(JSON.stringify(header)) + '.' + base64url(JSON.stringify(payload));

  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signingInput);
  const signature = sign.sign(JAAS_PRIVATE_KEY);

  return signingInput + '.' + base64url(signature);
}

// POST /api/video/call/[pazienteId]
// Avvia una videochiamata: genera JWT, invia comando al telefono, ritorna dati per il portale
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ pazienteId: string }> }
) {
  const { pazienteId: pazienteIdStr } = await params;
  const pazienteId = parseInt(pazienteIdStr);
  if (isNaN(pazienteId)) {
    return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const operatoreName = body.nome_operatore || 'Familiare';

    // Stanza fissa per paziente (più familiari entrano nella stessa stanza)
    const roomName = `chiamata_${pazienteId}`;

    // JWT per l'operatore (moderatore)
    const jwtModerator = generateJWT(roomName, operatoreName, true);

    // JWT per il telefono dell'anziano (partecipante)
    const jwtGuest = generateJWT(roomName, 'Utente', false);

    // Invia comando video_call al telefono via linktop_app_commands
    // Se esiste già un comando pending per questa stanza, non ne crea un altro
    const existing = await pool.query(
      `SELECT id FROM linktop_app_commands
       WHERE paziente_id = $1 AND command = 'video_call' AND status = 'pending'
       LIMIT 1`,
      [pazienteId]
    );

    if (existing.rows.length === 0) {
      await pool.query(
        `INSERT INTO linktop_app_commands (paziente_id, command, status, payload)
         VALUES ($1, 'video_call', 'pending', $2)`,
        [pazienteId, JSON.stringify({ room_name: roomName, jwt_guest: jwtGuest })]
      );
    }

    return NextResponse.json({
      success: true,
      room_name: roomName,
      jwt_moderator: jwtModerator,
      jaas_app_id: JAAS_APP_ID,
    });
  } catch (e: any) {
    console.error('[video/call] Errore:', e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

// DELETE /api/video/call/[pazienteId]
// Termina la chiamata: segna il comando come completato
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ pazienteId: string }> }
) {
  const { pazienteId: pazienteIdStr } = await params;
  const pazienteId = parseInt(pazienteIdStr);
  if (isNaN(pazienteId)) {
    return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });
  }

  try {
    await pool.query(
      `UPDATE linktop_app_commands
       SET status = 'completed'
       WHERE paziente_id = $1 AND command = 'video_call' AND status = 'pending'`,
      [pazienteId]
    );
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
