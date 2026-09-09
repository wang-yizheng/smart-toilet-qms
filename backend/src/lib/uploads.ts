import fs from 'node:fs'
import path from 'node:path'
import multer from 'multer'

/** Upload root; override with the UPLOAD_DIR environment variable if needed. */
export const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || process.cwd(), 'uploads')

export function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })
}

const MAX_SIZE = 5 * 1024 * 1024

const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureUploadDir()
    cb(null, UPLOAD_DIR)
  },
  filename: (_req, file, cb) => {
    const ext = (path.extname(file.originalname) || '.jpg').toLowerCase()
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`)
  },
})

/** Photo / attachment upload persisted to disk. */
export const uploadDisk = multer({ storage: diskStorage, limits: { fileSize: MAX_SIZE } })

/** In-memory upload, used for spreadsheet import. */
export const uploadMemory = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_SIZE } })
