import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { Op, fn, col } from 'sequelize'
import Admin from '../models/Admin'
import AdminSession from '../models/AdminSession'
import User from '../models/User'
import Report from '../models/Report'
import ContactMessage from '../models/ContactMessage'

const TOKEN_TTL_DAYS = 14

const createToken = () => crypto.randomBytes(32).toString('hex')

export const adminLogin = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      res.status(400).json({ status: 0, message: 'Missing credentials' })
      return
    }

    const admin = await Admin.findOne({ where: { email } })
    if (!admin) {
      res.status(401).json({ status: 0, message: 'Invalid credentials' })
      return
    }

    const ok = await bcrypt.compare(String(password), String((admin as any).passwordHash))
    if (!ok) {
      res.status(401).json({ status: 0, message: 'Invalid credentials' })
      return
    }

    const token = createToken()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + TOKEN_TTL_DAYS)

    await AdminSession.create({
      adminId: (admin as any).id,
      token,
      expiresAt,
    })

    res.status(200).json({ status: 1, token, expiresAt })
  } catch (e) {
    console.error('Admin login error:', e)
    res.status(500).json({ status: 0, message: 'Server error' })
  }
}

export const adminStats = async (_req: Request, res: Response) => {
  try {
    const totalUsers = await User.count()

    const activeSince = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const activeUsers = await User.count({ where: { lastActiveAt: { [Op.gte]: activeSince } } as any })

    const blockedUsers = await User.count({ where: { isBlocked: true } as any })

    const reportedUsers = await Report.count({ distinct: true, col: 'reported_user_id' as any })
    const totalReports = await Report.count()

    const totalContacts = await ContactMessage.count()

    res.status(200).json({
      totalUsers,
      activeUsers24h: activeUsers,
      blockedUsers,
      reportedUsers,
      totalReports,
      totalContacts,
    })
  } catch (e) {
    console.error('Admin stats error:', e)
    res.status(500).json({ status: 0, message: 'Server error' })
  }
}

export const adminListUsers = async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200)
    const offset = Math.max(Number(req.query.offset) || 0, 0)
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''

    const where: any = {}
    if (q) {
      where[Op.or] = [
        { email: { [Op.iLike]: `%${q}%` } },
        { phone: { [Op.iLike]: `%${q}%` } },
        { f_name: { [Op.iLike]: `%${q}%` } },
        { l_name: { [Op.iLike]: `%${q}%` } },
      ]
    }

    const users = await User.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      attributes: {
        exclude: ['password', 'OTP', 'OTPExpiry'],
      },
    })

    res.status(200).json(users)
  } catch (e) {
    console.error('Admin list users error:', e)
    res.status(500).json({ status: 0, message: 'Server error' })
  }
}

export const adminSetUserBlocked = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.params.id)
    const isBlocked = Boolean(req.body?.isBlocked)

    if (!userId) {
      res.status(400).json({ status: 0, message: 'Invalid user id' })
      return
    }

    const user = await User.findByPk(userId)
    if (!user) {
      res.status(404).json({ status: 0, message: 'User not found' })
      return
    }

    await user.update({ isBlocked } as any)

    res.status(200).json({ status: 1 })
  } catch (e) {
    console.error('Admin block user error:', e)
    res.status(500).json({ status: 0, message: 'Server error' })
  }
}

export const adminDeleteUser = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.params.id)
    if (!userId) {
      res.status(400).json({ status: 0, message: 'Invalid user id' })
      return
    }

    const user = await User.findByPk(userId)
    if (!user) {
      res.status(404).json({ status: 0, message: 'User not found' })
      return
    }

    await user.destroy()
    res.status(200).json({ status: 1 })
  } catch (e) {
    console.error('Admin delete user error:', e)
    res.status(500).json({ status: 0, message: 'Server error' })
  }
}

export const adminReportsSummary = async (_req: Request, res: Response) => {
  try {
    const grouped = await Report.findAll({
      attributes: [
        'reported_user_id',
        [fn('COUNT', col('id')), 'count'],
        [fn('MAX', col('createdAt')), 'lastReportAt'],
      ],
      group: ['reported_user_id'],
      order: [[fn('COUNT', col('id')), 'DESC']],
      limit: 200,
      raw: true,
    })

    const rows = await Promise.all(
      (grouped as any[]).map(async (g) => {
        const userId = Number(g.reported_user_id)
        const user = await User.findByPk(userId, {
          attributes: ['id', 'email', 'phone', 'f_name', 'l_name', 'isBlocked', 'lastActiveAt', 'createdAt'],
        })
        return {
          reported_user_id: userId,
          count: Number(g.count),
          lastReportAt: g.lastReportAt,
          user,
        }
      })
    )

    res.status(200).json(rows)
  } catch (e) {
    console.error('Admin reports summary error:', e)
    res.status(500).json({ status: 0, message: 'Server error' })
  }
}
