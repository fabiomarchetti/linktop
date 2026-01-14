// Script per hashare le password in chiaro in linktop_users
import bcrypt from 'bcryptjs'
import pkg from 'pg'
const { Pool } = pkg

const pool = new Pool({
  host: 'localhost',
  port: 5433, // Tunnel SSH
  database: 'gpswatch',
  user: 'gpsuser',
  password: 'GpsWatch2025',
})

async function hashPasswords() {
  try {
    console.log('🔐 Inizio hashing password...\n')

    // Leggi tutti gli utenti con password in chiaro
    const result = await pool.query('SELECT id, username, password FROM linktop_users')

    for (const user of result.rows) {
      // Verifica se la password è già un hash bcrypt (inizia con $2a$ o $2b$)
      if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
        console.log(`⏭️  ${user.username}: Password già hashata, skip`)
        continue
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(user.password, 10)

      // Aggiorna database
      await pool.query(
        'UPDATE linktop_users SET password = $1 WHERE id = $2',
        [hashedPassword, user.id]
      )

      console.log(`✅ ${user.username}: Password hashata con successo`)
      console.log(`   Chiaro: ${user.password}`)
      console.log(`   Hash:   ${hashedPassword.substring(0, 30)}...\n`)
    }

    console.log('✅ Tutte le password sono state hashate!')

  } catch (error) {
    console.error('❌ Errore:', error)
  } finally {
    await pool.end()
  }
}

hashPasswords()
