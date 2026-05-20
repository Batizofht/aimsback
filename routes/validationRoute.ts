import { Router, Request, Response } from 'express';
import User from '../models/User';

const validationRoute = Router();

// GET /api/validate/email?email=test@example.com
validationRoute.get('/email', async (req: Request, res: Response) => {
  const email = (req.query.email as string || '').trim().toLowerCase();

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    return res.status(200).json({ available: false, reason: 'invalid' });
  }

  try {
    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(200).json({ available: false, reason: 'taken' });
    }
    return res.status(200).json({ available: true });
  } catch (err) {
    console.error('Email validation error:', err);
    return res.status(500).json({ available: false, reason: 'error' });
  }
});

// GET /api/validate/phone?phone=+250791746049
validationRoute.get('/phone', async (req: Request, res: Response) => {
  const phone = (req.query.phone as string || '').trim().replace(/\s/g, '');

  const phoneRegex = /^\+[1-9]\d{6,14}$/;
  if (!phone || !phoneRegex.test(phone)) {
    return res.status(200).json({ available: false, reason: 'invalid' });
  }

  try {
    const existing = await User.findOne({ where: { phone } });
    if (existing) {
      return res.status(200).json({ available: false, reason: 'taken' });
    }
    return res.status(200).json({ available: true });
  } catch (err) {
    console.error('Phone validation error:', err);
    return res.status(500).json({ available: false, reason: 'error' });
  }
});

export default validationRoute;
