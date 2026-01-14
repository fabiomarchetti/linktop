// Script per ripristinare password in chiaro da GPS
import pkg from 'pg'
const { Pool } = pkg

const pool = new Pool({
  host: 'localhost',
  port: 5433,
  database: 'gpswatch',
  user: 'gpsuser',
  password: 'GpsWatch2025',
})

async function restorePasswords() {
  try {
    console.log('🔓 Ripristino password in chiaro da GPS...\n')

    // Leggi password da users GPS
    const gpsUsers = await pool.query('SELECT username, password FROM users')

    for (const gpsUser of gpsUsers.rows) {
      // Aggiorna linktop_users con stessa password di GPS
      const result = await pool.query(
        'UPDATE linktop_users SET password = $1 WHERE username = $2 RETURNING username, password',
        [gpsUser.password, gpsUser.username]
      )

      if (result.rowCount > 0) {
        console.log(`✅ ${gpsUser.username}: Password ripristinata in chiaro`)
        console.log(`   Password: ${gpsUser.password}\n`)
      }
    }

    console.log('✅ Tutte le password sono state ripristinate in chiaro!')

  } catch (error) {
    console.error('❌ Errore:', error)
  } finally {
    await pool.end()
  }
}

restorePasswords()
