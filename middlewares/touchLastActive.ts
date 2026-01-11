import type { Request, Response, NextFunction } from 'express'
import User from '../models/User'

const toNumber = (v: any): number | null => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

export const touchLastActive = (req: Request, _res: Response, next: NextFunction) => {
  try {
    const candidates: any[] = [
      req.body?.owner,
      req.body?.user,
      req.body?.userid,
      req.query?.owner,
      req.query?.userid,
      req.query?.post,
      req.query?.deleteAccount,
    ]

    const id = candidates.map(toNumber).find((x) => x != null)

    if (id) {
      void User.update(
        { lastActiveAt: new Date() } as any,
        {
          where: { id },
        }
      )
    }
  } catch {
    // ignore
  }

  next()
}
