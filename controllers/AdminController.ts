import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { Op, fn, col, literal, QueryTypes } from 'sequelize'
import Admin from '../models/Admin'
import AdminSession from '../models/AdminSession'
import User from '../models/User'
import Report from '../models/Report'
import ContactMessage from '../models/ContactMessage'
import Match from '../models/Match'
import Message from '../models/Message'
import Notification from '../models/Notification'
import PushToken from '../models/PushToken'
import CallLog from '../models/CallLog'
import { sendBlockedEmail, sendWarningEmail, sendUnblockedEmail } from '../utils/email'

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

export const adminUserGrowth = async (req: Request, res: Response) => {
  try {
    // Ensure strikes column exists
    await User.sequelize?.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS strikes INTEGER DEFAULT 0;')

    const period = req.query.period as 'day' | 'week' | 'month' | 'year' || 'day'
    const now = new Date()
    let startDate: Date
    let groupBy: string
    let selectGroupBy: string
    let reportsGroupBy: string
    let reportsSelectGroupBy: string

    switch (period) {
      case 'day':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30) // Last 30 days
        groupBy = 'DATE_TRUNC(\'day\', "User"."createdAt")'
        selectGroupBy = 'DATE_TRUNC(\'day\', "User"."createdAt")'
        reportsGroupBy = 'DATE_TRUNC(\'day\', "createdAt")'
        reportsSelectGroupBy = 'DATE_TRUNC(\'day\', "createdAt")'
        break
      case 'week':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 28) // Last 4 weeks
        groupBy = 'DATE_TRUNC(\'week\', "User"."createdAt")'
        selectGroupBy = 'DATE_TRUNC(\'week\', "User"."createdAt")'
        reportsGroupBy = 'DATE_TRUNC(\'week\', "createdAt")'
        reportsSelectGroupBy = 'DATE_TRUNC(\'week\', "createdAt")'
        break
      case 'month':
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1) // Last 12 months
        groupBy = 'DATE_TRUNC(\'month\', "User"."createdAt")'
        selectGroupBy = 'DATE_TRUNC(\'month\', "User"."createdAt")'
        reportsGroupBy = 'DATE_TRUNC(\'month\', "createdAt")'
        reportsSelectGroupBy = 'DATE_TRUNC(\'month\', "createdAt")'
        break
      case 'year':
        startDate = new Date(now.getFullYear() - 5, 0, 1) // Last 5 years
        groupBy = 'DATE_TRUNC(\'year\', "User"."createdAt")'
        selectGroupBy = 'DATE_TRUNC(\'year\', "User"."createdAt")'
        reportsGroupBy = 'DATE_TRUNC(\'year\', "createdAt")'
        reportsSelectGroupBy = 'DATE_TRUNC(\'year\', "createdAt")'
        break
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30)
        groupBy = 'DATE_TRUNC(\'day\', "User"."createdAt")'
        selectGroupBy = 'DATE_TRUNC(\'day\', "User"."createdAt")'
        reportsGroupBy = 'DATE_TRUNC(\'day\', "createdAt")'
        reportsSelectGroupBy = 'DATE_TRUNC(\'day\', "createdAt")'
    }

    // Get new users per period
    const newUsersData = await User.findAll({
      where: {
        createdAt: {
          [Op.gte]: startDate
        }
      },
      attributes: [
        [literal(selectGroupBy), 'period'],
        [fn('COUNT', col('id')), 'count']
      ],
      group: [literal(groupBy)],
      raw: true
    }) as any[]

    // Get reported users per period - simplified query using reports table
    const reportedUsersData = await User.sequelize!.query(`
      SELECT ${reportsSelectGroupBy} as period, COUNT(*) as count
      FROM reports
      WHERE "createdAt" >= :startDate
      GROUP BY ${reportsGroupBy}
      ORDER BY period
    `, {
      replacements: { startDate: startDate.toISOString() },
      type: QueryTypes.SELECT
    }) as any[]

    // Get matched users (users with strikes)
    const matchedUsersData = await User.findAll({
      where: {
        createdAt: {
          [Op.gte]: startDate
        },
        strikes: {
          [Op.gt]: 0
        }
      },
      attributes: [
        [literal(selectGroupBy), 'period'],
        [fn('COUNT', col('id')), 'count']
      ],
      group: [literal(groupBy)],
      raw: true
    }) as any[]

    // Combine data into chart format
    const chartData: any[] = []
    const allPeriods = new Set<string>()

    // Collect all periods
    newUsersData.forEach((item: any) => allPeriods.add(item.period))
    reportedUsersData.forEach((item: any) => allPeriods.add(item.period))
    matchedUsersData.forEach((item: any) => allPeriods.add(item.period))

    // Create chart data for each period
    allPeriods.forEach((period: string) => {
      const newUsers = (newUsersData.find((item: any) => item.period === period)?.count) || 0
      const reportedUsers = (reportedUsersData.find((item: any) => item.period === period)?.count) || 0
      const matchedUsers = (matchedUsersData.find((item: any) => item.period === period)?.count) || 0

      chartData.push({
        date: period,
        newUsers: Number(newUsers),
        reportedUsers: Number(reportedUsers),
        matchedUsers: Number(matchedUsers)
      })
    })

    // Sort by date
    chartData.sort((a, b) => {
      const dateA = new Date(a.date)
      const dateB = new Date(b.date)
      return dateA.getTime() - dateB.getTime()
    })

    res.status(200).json(chartData)
  } catch (e) {
    console.error('Admin user growth error:', e)
    res.status(500).json({ status: 0, message: 'Server error' })
  }
}

export const adminStats = async (req: Request, res: Response) => {
  try {
    // Ensure strikes column exists
    await User.sequelize?.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS strikes INTEGER DEFAULT 0;')

    const verifiedWhere = { IsVerified: true }
    const totalUsers = await User.count({ where: verifiedWhere })

    const activeSince = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const activeUsers = await User.count({ 
      where: { 
        lastActiveAt: { [Op.gte]: activeSince },
        ...verifiedWhere
      } as any 
    })

    const blockedUsers = await User.count({ 
      where: { 
        isBlocked: true,
        ...verifiedWhere
      } as any 
    })

    const reportedUsers = await Report.count({ distinct: true, col: 'reported_user_id' as any })
    const totalReports = await Report.count()

    const totalContacts = await ContactMessage.count()

    const totalStrikes = await User.sum('strikes', { 
      where: { 
        strikes: { [Op.gt]: 0 },
        ...verifiedWhere
      } } as any 
    ) || 0

    const totalMatchedPeople = await User.count({ 
      where: { 
        strikes: { [Op.gt]: 0 },
        ...verifiedWhere
      } } as any 
    ) || 0

    res.status(200).json({
      totalUsers,
      activeUsers24h: activeUsers,
      blockedUsers,
      reportedUsers,
      totalReports,
      totalContacts,
      totalStrikes,
      totalMatchedPeople,
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

    // Send email notification to user
    const userEmail = String((user as any).email || '')
    if (userEmail) {
      if (isBlocked) {
        void sendBlockedEmail(userEmail, 'Violation of community guidelines')
      } else {
        void sendUnblockedEmail(userEmail)
      }
    }

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

    // Cascade delete all associated data
    await Match.destroy({ where: { [Op.or]: [{ user_id: userId }, { matched_user_id: userId }] } as any })
    await Message.destroy({ where: { [Op.or]: [{ sender_id: userId }, { receiver_id: userId }] } as any })
    await Notification.destroy({ where: { [Op.or]: [{ user_id: userId }, { sender_id: userId }] } as any })
    await PushToken.destroy({ where: { user_id: userId } as any })
    await CallLog.destroy({ where: { [Op.or]: [{ caller_id: userId }, { callee_id: userId }] } as any })
    await Report.destroy({ where: { [Op.or]: [{ reporter_id: userId }, { reported_user_id: userId }] } as any })

    await user.destroy()
    res.status(200).json({ status: 1 })
  } catch (e) {
    console.error('Admin delete user error:', e)
    res.status(500).json({ status: 0, message: 'Server error' })
  }
}

export const adminReportsSummary = async (_req: Request, res: Response) => {
  try {
    // Ensure strikes column exists
    await User.sequelize?.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS strikes INTEGER DEFAULT 0;')

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
          attributes: ['id', 'email', 'phone', 'f_name', 'l_name', 'isBlocked', 'strikes', 'lastActiveAt', 'createdAt'],
        })

        const latestReport = await Report.findOne({
          where: { reported_user_id: userId } as any,
          order: [['createdAt', 'DESC']],
          raw: true,
        })

        const reporterId = latestReport ? Number((latestReport as any).reporter_id) : null
        const reporter = reporterId
          ? await User.findByPk(reporterId, {
              attributes: ['id', 'email', 'phone', 'f_name', 'l_name'],
            })
          : null

        return {
          reported_user_id: userId,
          count: Number(g.count),
          lastReportAt: g.lastReportAt,
          lastReportType: latestReport ? (latestReport as any).report_type : null,
          lastReporter: reporter,
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

export const adminWarnReportedUser = async (req: Request, res: Response) => {
  try {
    // Ensure strikes column exists
    await User.sequelize?.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS strikes INTEGER DEFAULT 0;')

    const userId = Number(req.params.id)
    const reason = String(req.body?.reason || req.body?.reportType || 'Violation of community guidelines')

    if (!userId) {
      res.status(400).json({ status: 0, message: 'Invalid user id' })
      return
    }

    const user = await User.findByPk(userId)
    if (!user) {
      res.status(404).json({ status: 0, message: 'User not found' })
      return
    }

    const nextStrikes = Number((user as any).strikes || 0) + 1
    await user.update({ strikes: nextStrikes } as any)

    const emailed = await sendWarningEmail(String((user as any).email), nextStrikes, reason)

    res.status(200).json({ status: 1, strikes: nextStrikes, emailed, canBlock: nextStrikes >= 3 })
  } catch (e) {
    console.error('Admin warn user error:', e)
    res.status(500).json({ status: 0, message: 'Server error' })
  }
}

export const adminBlockReportedUser = async (req: Request, res: Response) => {
  try {
    // Ensure strikes column exists
    await User.sequelize?.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS strikes INTEGER DEFAULT 0;')

    const userId = Number(req.params.id)
    const reason = String(req.body?.reason || 'Repeated violations')

    if (!userId) {
      res.status(400).json({ status: 0, message: 'Invalid user id' })
      return
    }

    const user = await User.findByPk(userId)
    if (!user) {
      res.status(404).json({ status: 0, message: 'User not found' })
      return
    }

    await user.update({ isBlocked: true } as any)
    const emailed = await sendBlockedEmail(String((user as any).email), reason)

    res.status(200).json({ status: 1, emailed })
  } catch (e) {
    console.error('Admin block user error:', e)
    res.status(500).json({ status: 0, message: 'Server error' })
  }
}
