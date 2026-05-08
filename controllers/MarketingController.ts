import { Request, Response } from "express";
import User from "../models/User";
import { Op } from "sequelize";

// Get marketing metrics - REAL data from database
export const getMarketingMetrics = async (req: Request, res: Response) => {
  try {
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000);

    // Total users (as proxy for app installs)
    const totalUsers = await User.count();
    
    // New users in last 30 days
    const newUsers30Days = await User.count({
      where: {
        createdAt: {
          [Op.gte]: thirtyDaysAgo,
        },
      },
    });

    // New users in previous 30 days (for comparison)
    const newUsersPrev30Days = await User.count({
      where: {
        createdAt: {
          [Op.gte]: sixtyDaysAgo,
          [Op.lt]: thirtyDaysAgo,
        },
      },
    });

    // Active users (not blocked)
    const activeUsers = await User.count({
      where: { isBlocked: false },
    });

    // Verified users
    const verifiedUsers = await User.count({
      where: { IsVerified: true },
    });

    // Calculate growth rate
    const growthRate = newUsersPrev30Days > 0
      ? ((newUsers30Days - newUsersPrev30Days) / newUsersPrev30Days) * 100
      : 0;

    // For now, conversion is 0 until premium tracking is added
    const conversionRate = 0;

    res.status(200).json({
      status: 1,
      metrics: {
        totalUsers,
        newUsers30Days,
        activeUsers,
        verifiedUsers,
        growthRate: parseFloat(growthRate.toFixed(2)),
        conversionRate: parseFloat(conversionRate.toFixed(2)),
      },
    });
  } catch (error: any) {
    console.error("Get marketing metrics error:", error);
    res.status(500).json({ message: "Server error", status: 0 });
  }
};

// Get user growth over time
export const getUserGrowth = async (req: Request, res: Response) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - Number(days));

    const users = await User.findAll({
      where: {
        createdAt: {
          [Op.gte]: startDate,
        },
      },
      attributes: ["createdAt"],
      order: [["createdAt", "ASC"]],
    });

    // Group by date
    const grouped = users.reduce((acc: any, user: any) => {
      const date = new Date(user.createdAt).toISOString().split("T")[0];
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {});

    const growth = Object.entries(grouped).map(([date, count]) => ({
      date,
      count,
    }));

    res.status(200).json({ status: 1, growth });
  } catch (error: any) {
    console.error("Get user growth error:", error);
    res.status(500).json({ message: "Server error", status: 0 });
  }
};
