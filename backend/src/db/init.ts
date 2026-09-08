import fs from 'fs'
import bcrypt from 'bcryptjs'
import { pool, query } from '../config/db'
import { env } from '../config/env'

export const schema = fs.readFileSync(new URL('schema.sql', import.meta.url), 'utf-8')

const DEFAULT_USERS = [
  { username: 'admin', name: '系统管理员', role: 'admin', password: 'admin123' },
  { username: 'qc', name: '质检主管', role: 'qc_manager', password: 'qc123456' },
  { username: 'inspector', name: '检测员', role: 'inspector', password: 'insp123456' },
  { username: 'producer', name: '生产人员', role: 'producer', password: 'prod123456' },
]

export async function ensureSchema() {
  await query(schema)
}

export async function ensureAdminUsers() {
  for (const u of DEFAULT_USERS) {
    const exists = await query('SELECT id FROM users WHERE username = $1', [u.username])
    if (exists.length) continue
    const hash = await bcrypt.hash(u.password, 10)
    await query(
      'INSERT INTO users (username, password_hash, name, role, status) VALUES ($1,$2,$3,$4,$5)',
      [u.username, hash, u.name, u.role, 'active']
    )
  }
}

export async function initDatabase() {
  console.log('Initializing database schema...')
  await ensureSchema()
  await ensureAdminUsers()
  console.log('Database initialization complete.')
}

// Run directly: pnpm db:init
if (import.meta.url === `file://${process.argv[1]}`) {
  initDatabase()
    .then(() => pool.end())
    .catch((err) => {
      console.error('Init failed:', err)
      process.exit(1)
    })
}
