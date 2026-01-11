import { Request, Response, NextFunction } from 'express'
import { Op } from 'sequelize'
import AdminSession from '../models/AdminSession'

export type AuthedAdminRequest = Request & {
  adminId?: number
}

export const requireAdmin = async (req: AuthedAdminRequest, res: Response, next: NextFunction) => {
  try {
    const header = req.headers.authorization
    const token = header && header.toLowerCase().startsWith('bearer ') ? header.slice(7) : null

    if (!token) {
      res.status(401).json({ status: 0, message: 'Missing admin token' })
      return
    }

    const session = await AdminSession.findOne({
      where: {
        token,
        expiresAt: { [Op.gt]: new Date() },
      },
    })

    if (!session) {
      res.status(401).json({ status: 0, message: 'Invalid or expired admin token' })
      return
    }

    req.adminId = session.adminId
    next()
  } catch (e) {
    console.error('Admin auth error:', e)
    res.status(500).json({ status: 0, message: 'Server error' })
  }
}
