import { Request, Response } from "express";
import User from "../models/User";

// Mark notifications as read (nubook.php)
export const markNotificationsRead = async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;
    // This endpoint is called but doesn't need to do anything specific
    // Just return success
    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("Mark notifications read error:", error);
    res.status(500).json({ success: false });
  }
};

