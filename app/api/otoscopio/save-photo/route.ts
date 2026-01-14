import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import path from 'path'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('photo') as File
    const patientCode = formData.get('patientCode') as string

    if (!file) {
      return NextResponse.json({ error: 'Nessun file foto' }, { status: 400 })
    }

    // Crea nome file con timestamp e info paziente
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const patientPrefix = patientCode ? `${patientCode}_` : ''
    const filename = `${patientPrefix}otoscopio_${timestamp}.jpg`

    // Path assoluto alla cartella otoscopio_foto
    const uploadDir = path.join(process.cwd(), 'otoscopio_foto')
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
    console.error('Errore salvataggio foto:', error)
    return NextResponse.json(
      { error: 'Errore salvataggio file', details: error.message },
      { status: 500 }
    )
  }
}
