import fs from 'fs'
import multer from 'multer'

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const folder = 'uploads/blog-covers'
    fs.mkdirSync(folder, { recursive: true })
    cb(null, folder)
  },
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9._-]/g, '')
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
    cb(null, `${unique}-${safeName}`)
  },
})

const blogCoverUpload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024,
  },
})

export default blogCoverUpload
