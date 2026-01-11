import { Request, Response } from 'express'
import ContactMessage from '../models/ContactMessage'

export const submitContactMessage = async (req: Request, res: Response) => {
  try {
    const { name, email, message } = req.body

    if (!name || !email || !message) {
      res.status(400).json({ status: 0, message: 'Missing required fields' })
      return
    }

    const created = await ContactMessage.create({
      name,
      email,
      message,
    })

    res.status(201).json({ status: 1, id: created.id, message: 'Message received' })
  } catch (error: any) {
    console.error('Submit contact error:', error)
    res.status(500).json({ status: 0, message: 'Server error' })
  }
}

export const getContactMessages = async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200)
    const offset = Math.max(Number(req.query.offset) || 0, 0)

    const rows = await ContactMessage.findAll({
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    })

    res.status(200).json(rows)
  } catch (error: any) {
    console.error('Get contact messages error:', error)
    res.status(500).json({ status: 0, message: 'Server error' })
  }
}
