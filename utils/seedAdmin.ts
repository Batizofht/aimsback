import bcrypt from 'bcryptjs'
import Admin from '../models/Admin'

export const seedAdminIfNeeded = async () => {
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD

  if (!email || !password) {
    return
  }

  const existing = await Admin.findOne({ where: { email } })
  if (existing) return

  const passwordHash = await bcrypt.hash(password, 10)
  await Admin.create({ email, passwordHash })
  console.log('Seeded admin account:', email)
}
