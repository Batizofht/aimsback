import { Request, Response } from 'express';

export const getVideoToken = async (_req: Request, res: Response) => {
  res.status(410).json({ message: 'Stream Video token endpoint removed (using Jitsi WebView)', status: 0 });
};
