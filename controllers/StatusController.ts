import { Request, Response } from "express";
import User from "../models/User";

// set user status to 'Active' or 'Offline'
export const setStatus = async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    const userId = Number(req.query.userId);
    if (!userId || !['Active', 'Offline'].includes(status as string)) {
      res.status(400).json({ message: "Invalid userId or status", status: 0 });
      return;
    }

    await User.update({ 
      status: status as 'Active' | 'Offline',
      lastActiveAt: new Date()
    }, { where: { id: userId } });
    res.status(200).json({ status: 1 });
  } catch (error: any) {
    console.error("Set status error:", error);
    res.status(500).json({ message: "Server error", status: 0 });
  }
};

