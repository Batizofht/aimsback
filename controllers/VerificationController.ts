import { Request, Response } from 'express'
import User from '../models/User'

const ensureVerificationColumns = async () => {
  // Keep this defensive: the project uses runtime ALTER TABLE in controllers.
  // Use VARCHAR/TEXT columns to avoid enum-type migration problems.
  await User.sequelize?.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS "verificationStatus" VARCHAR(20) NOT NULL DEFAULT 'unverified';`)
  await User.sequelize?.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS "verificationDocType" VARCHAR(50);`)
  await User.sequelize?.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS "verificationDocFront" VARCHAR(500);`)
  await User.sequelize?.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS "verificationDocBack" VARCHAR(500);`)
  await User.sequelize?.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS "verificationVideo" VARCHAR(500);`)
  await User.sequelize?.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS "verificationSubmittedAt" TIMESTAMP;`)
  await User.sequelize?.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS "verificationReviewedAt" TIMESTAMP;`)
  await User.sequelize?.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS "verificationRejectionReason" TEXT;`)
}

export const submitVerification = async (req: Request, res: Response) => {
  try {
    await ensureVerificationColumns()

    const userId = Number((req.body as any)?.userId || (req.body as any)?.user || (req.body as any)?.userid)
    const verificationDocType = String((req.body as any)?.docType || (req.body as any)?.verificationDocType || '')

    if (!userId) {
      res.status(400).json({ status: 0, message: 'Missing userId' })
      return
    }

    if (!verificationDocType) {
      res.status(400).json({ status: 0, message: 'Missing docType' })
      return
    }

    const user = await User.findByPk(userId)
    if (!user) {
      res.status(404).json({ status: 0, message: 'User not found' })
      return
    }

    const files = (req as any).files as
      | {
          [fieldname: string]: Express.Multer.File[]
        }
      | undefined

    const docFront = files?.verificationDocFront?.[0]?.filename || null
    const docBack = files?.verificationDocBack?.[0]?.filename || null
    const video = files?.verificationVideo?.[0]?.filename || null

    if (!docFront || !video) {
      res.status(400).json({ status: 0, message: 'Document front image and verification video are required' })
      return
    }

    await user.update({
      verificationStatus: 'pending',
      verificationDocType,
      verificationDocFront: docFront,
      verificationDocBack: docBack,
      verificationVideo: video,
      verificationSubmittedAt: new Date(),
      verificationReviewedAt: null,
      verificationRejectionReason: null,
    } as any)

    res.status(200).json({ status: 1, verificationStatus: 'pending' })
  } catch (e) {
    console.error('Submit verification error:', e)
    res.status(500).json({ status: 0, message: 'Server error' })
  }
}

export const getMyVerificationStatus = async (req: Request, res: Response) => {
  try {
    await ensureVerificationColumns()

    const userId = Number(req.query.userId || req.query.userid || req.query.user)
    if (!userId) {
      res.status(400).json({ status: 0, message: 'Missing userId' })
      return
    }

    const user = await User.findByPk(userId, {
      attributes: [
        'id',
        'verificationStatus',
        'verificationDocType',
        'verificationSubmittedAt',
        'verificationReviewedAt',
        'verificationRejectionReason',
      ] as any,
    })

    if (!user) {
      res.status(404).json({ status: 0, message: 'User not found' })
      return
    }

    res.status(200).json({ status: 1, ...(user.toJSON() as any) })
  } catch (e) {
    console.error('Get verification status error:', e)
    res.status(500).json({ status: 0, message: 'Server error' })
  }
}

export const adminListVerification = async (req: Request, res: Response) => {
  try {
    await ensureVerificationColumns()

    const rawStatus = typeof req.query.status === 'string' ? req.query.status : 'pending'
    const status = ['unverified', 'pending', 'verified', 'rejected'].includes(rawStatus) ? rawStatus : 'pending'

    const rows = await User.findAll({
      where: {
        verificationStatus: status,
      } as any,
      order: [['verificationSubmittedAt', 'DESC']],
      attributes: {
        exclude: ['password', 'OTP', 'OTPExpiry'],
      },
      limit: 500,
    })

    res.status(200).json(rows)
  } catch (e) {
    console.error('Admin list verification error:', e)
    res.status(500).json({ status: 0, message: 'Server error' })
  }
}

export const adminReviewVerification = async (req: Request, res: Response) => {
  try {
    await ensureVerificationColumns()

    const userId = Number(req.params.id)
    const decision = String((req.body as any)?.status || '').toLowerCase()
    const reason = String((req.body as any)?.reason || '')

    if (!userId) {
      res.status(400).json({ status: 0, message: 'Invalid user id' })
      return
    }

    if (decision !== 'verified' && decision !== 'rejected') {
      res.status(400).json({ status: 0, message: 'Invalid status. Use verified or rejected.' })
      return
    }

    const user = await User.findByPk(userId)
    if (!user) {
      res.status(404).json({ status: 0, message: 'User not found' })
      return
    }

    await user.update({
      verificationStatus: decision,
      verificationReviewedAt: new Date(),
      verificationRejectionReason: decision === 'rejected' ? (reason || 'Rejected') : null,
    } as any)

    res.status(200).json({ status: 1 })
  } catch (e) {
    console.error('Admin review verification error:', e)
    res.status(500).json({ status: 0, message: 'Server error' })
  }
}
