import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import path from 'path'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('audio') as File
    const patientCode = formData.get('patientCode') as string
    const mode = formData.get('mode') as string // 'heart' or 'lung'

    if (!file) {
      return NextResponse.json({ error: 'Nessun file audio' }, { status: 400 })
    }

    // Crea nome file con timestamp e info paziente
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const patientPrefix = patientCode ? `${patientCode}_` : ''
    const modeLabel = mode === 'lung' ? 'polmoni' : 'cuore'
    const filename = `${patientPrefix}${modeLabel}_${timestamp}.wav`

    // Path assoluto alla cartella stetoscopio_wav
    const uploadDir = path.join(process.cwd(), 'stetoscopio_wav')
    const filePath = path.join(uploadDir, filename)

    // Converti file in buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Salva file
    await writeFile(filePath, buffer)

    return NextResponse.json({
      success: true,
      filename,
      path: filePath,
      size: buffer.length
    })

  } catch (error: any) {
    console.error('Errore salvataggio registrazione:', error)
    return NextResponse.json(
      { error: 'Errore salvataggio file', details: error.message },
      { status: 500 }
    )
  }
}
