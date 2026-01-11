import { Request, Response } from "express";
import Report from "../models/Report";

// Submit a report
export const submitReport = async (req: Request, res: Response) => {
  try {
    const { reporter_id, reported_user_id, report_type } = req.body;

    if (!reporter_id || !reported_user_id || !report_type) {
      res.status(400).json({ message: "Missing required fields", status: 0 });
      return;
    }

    // Prevent self-reporting
    if (reporter_id === reported_user_id) {
      res.status(400).json({ message: "Cannot report yourself", status: 0 });
      return;
    }

    const report = await Report.create({
      reporter_id,
      reported_user_id,
      report_type,
    });

    res.status(201).json({
      message: "Report submitted successfully",
      status: 1,
      report_id: report.id,
    });
  } catch (error: any) {
    console.error("Submit report error:", error);
    res.status(500).json({ message: "Server error", status: 0 });
  }
};

// Get reports (admin use)
export const getReports = async (req: Request, res: Response) => {
  try {
    const reports = await Report.findAll({
      order: [['createdAt', 'DESC']],
      limit: 100,
    });

    res.status(200).json(reports);
  } catch (error: any) {
    console.error("Get reports error:", error);
    res.status(500).json({ message: "Server error", status: 0 });
  }
};

// Get reports for a specific user
export const getReportsForUser = async (req: Request, res: Response) => {
  try {
    const { user_id } = req.query;
    const userId = Number(user_id);

    if (!userId) {
      res.status(400).json({ message: "User ID is required", status: 0 });
      return;
    }

    const reports = await Report.findAll({
      where: { reported_user_id: userId },
      order: [['createdAt', 'DESC']],
    });

    res.status(200).json(reports);
  } catch (error: any) {
    console.error("Get user reports error:", error);
    res.status(500).json({ message: "Server error", status: 0 });
  }
};
