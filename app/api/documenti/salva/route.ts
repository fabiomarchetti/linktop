import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import path from 'path'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const filename = formData.get('filename') as string

    if (!file || !filename) {
      return NextResponse.json(
        { error: 'File e filename sono obbligatori' },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    
    // Assicurati che la cartella esista (il comando mkdir è stato già eseguito, ma per sicurezza in futuro...)
    const uploadDir = path.join(process.cwd(), 'liberatorie_pdf')
    const filePath = path.join(uploadDir, filename)

    await writeFile(filePath, buffer)

    return NextResponse.json({ success: true, path: filePath })
  } catch (error: any) {
    console.error('Errore salvataggio PDF:', error)
    return NextResponse.json(
      { error: 'Errore salvataggio file', details: error.message },
      { status: 500 }
    )
  }
}
