import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { Op, fn, col, literal, QueryTypes } from "sequelize";
import Admin from "../models/Admin";
import AdminSession from "../models/AdminSession";
import User from "../models/User";
import Report from "../models/Report";
import ContactMessage from "../models/ContactMessage";
import Match from "../models/Match";
import Message from "../models/Message";
import Notification from "../models/Notification";
import PushToken from "../models/PushToken";
import CallLog from "../models/CallLog";
import UserRole from "../models/UserRole";
import {
  sendBlockedEmail,
  sendWarningEmail,
  sendUnblockedEmail,
} from "../utils/email";
import Role from "../models/Role";
import AdminRole from "../models/AdminRole";
import UserPhotoReview from "../models/UserPhotoReview";
import {
  approveUserPhoto,
  rejectUserPhoto,
  sendRejectionNotifications,
} from "../utils/photoReview";

const TOKEN_TTL_DAYS = 14;

const createToken = () => crypto.randomBytes(32).toString("hex");

export const updateAdmin = async (req: Request, res: Response) => {
  try {
    const adminId = Number(req.params.id);
    const { email, f_name, l_name, password, roleIds } = req.body;

    if (!adminId || Number.isNaN(adminId)) {
      res.status(400).json({ status: 0, message: "Invalid admin id" });
      return;
    }

    const admin = await Admin.findByPk(adminId);
    if (!admin) {
      res.status(404).json({ status: 0, message: "Admin not found" });
      return;
    }

    if (email && email !== admin.email) {
      const existing = await Admin.findOne({ where: { email } });
      if (existing) {
        res.status(400).json({ status: 0, message: "Email already in use" });
        return;
      }
      (admin as any).email = email;
    }

    if (typeof f_name !== "undefined") (admin as any).f_name = f_name;
    if (typeof l_name !== "undefined") (admin as any).l_name = l_name;

    if (typeof password === "string" && password.trim()) {
      (admin as any).passwordHash = await bcrypt.hash(password, 10);
    }

    await admin.save();

    if (Array.isArray(roleIds)) {
      const desiredRoleIds = roleIds.map((r: any) => Number(r)).filter((n: number) => !Number.isNaN(n));
      const existingAdminRoles = await AdminRole.findAll({ where: { adminId } });
      const existingRoleIds = new Set(existingAdminRoles.map((ar: any) => Number(ar.roleId)));
      const desiredRoleIdSet = new Set(desiredRoleIds);

      // Remove roles not desired
      const toRemove = Array.from(existingRoleIds).filter((rid) => !desiredRoleIdSet.has(rid));
      if (toRemove.length > 0) {
        await AdminRole.destroy({ where: { adminId, roleId: toRemove } as any });
      }

      // Add missing roles
      const assignedBy = (req as any).admin?.id;
      for (const rid of desiredRoleIds) {
        if (!existingRoleIds.has(rid)) {
          await AdminRole.create({ adminId, roleId: rid, assignedBy } as any);
        }
      }
    }

    res.status(200).json({ status: 1, message: "Admin updated" });
  } catch (error: any) {
    console.error("Update admin error:", error);
    res.status(500).json({ status: 0, message: "Server error", error: error.message });
  }
};

export const deleteAdmin = async (req: Request, res: Response) => {
  try {
    const adminId = Number(req.params.id);
    if (!adminId || Number.isNaN(adminId)) {
      res.status(400).json({ status: 0, message: "Invalid admin id" });
      return;
    }

    // prevent self delete
    const requesterId = (req as any).admin?.id;
    if (requesterId && Number(requesterId) === adminId) {
      res.status(400).json({ status: 0, message: "You cannot delete your own admin account" });
      return;
    }

    await AdminRole.destroy({ where: { adminId } });
    const deleted = await Admin.destroy({ where: { id: adminId } });

    if (!deleted) {
      res.status(404).json({ status: 0, message: "Admin not found" });
      return;
    }

    res.status(200).json({ status: 1, message: "Admin deleted" });
  } catch (error: any) {
    console.error("Delete admin error:", error);
    res.status(500).json({ status: 0, message: "Server error", error: error.message });
  }
};

export const getMyAdminProfile = async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).admin?.id || (req as any).adminId;
    if (!adminId) {
      res.status(401).json({ status: 0, message: "Not authenticated" });
      return;
    }

    const admin = await Admin.findByPk(adminId, {
      attributes: ["id", "email", "f_name", "l_name", "isSuperAdmin", "isActive"],
      include: [
        {
          model: Role,
          as: "roles",
          where: { isActive: true },
          required: false,
          through: { attributes: [] },
        },
      ],
    });

    if (!admin) {
      res.status(404).json({ status: 0, message: "Admin not found" });
      return;
    }

    const roles = ((admin as any).roles || []) as any[];
    const pages = Array.from(
      new Set(
        roles.flatMap((r) => (Array.isArray(r.permissions) ? r.permissions : []))
      )
    );

    res.status(200).json({
      status: 1,
      admin: {
        id: (admin as any).id,
        email: (admin as any).email,
        f_name: (admin as any).f_name,
        l_name: (admin as any).l_name,
        isSuperAdmin: (admin as any).isSuperAdmin,
        isActive: (admin as any).isActive,
      },
      pages,
    });
  } catch (error: any) {
    console.error("Get my admin profile error:", error);
    res.status(500).json({ status: 0, message: "Server error", error: error.message });
  }
};

export const createAdmin = async (req: Request, res: Response) => {
  try {
    const { email, password, f_name, l_name, roleIds } = req.body;

    if (!email || !password) {
      res.status(400).json({ status: 0, message: "Email and password are required" });
      return;
    }

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ where: { email } });
    if (existingAdmin) {
      res.status(400).json({ status: 0, message: "Admin with this email already exists" });
      return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create admin
    const admin = await Admin.create({
      email,
      passwordHash,
      f_name,
      l_name,
      isActive: true,
      isSuperAdmin: false,
    });

    // Assign roles if provided
    if (roleIds && Array.isArray(roleIds) && roleIds.length > 0) {
      const assignedBy = (req as any).admin?.id;
      for (const roleId of roleIds) {
        await AdminRole.findOrCreate({
          where: { adminId: admin.id, roleId },
          defaults: { adminId: admin.id, roleId, assignedBy },
        });
      }
    }

    res.status(201).json({
      status: 1,
      message: "Admin created successfully",
      admin: {
        id: admin.id,
        email: admin.email,
        f_name: admin.f_name,
        l_name: admin.l_name,
        isActive: admin.isActive,
        isSuperAdmin: admin.isSuperAdmin,
        createdAt: admin.createdAt,
      },
    });
  } catch (error: any) {
    console.error("Create admin error:", error);
    res.status(500).json({
      status: 0,
      message: "Server error",
      error: error.message,
    });
  }
};

export const adminLogin = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ status: 0, message: "Missing credentials" });
      return;
    }

    const admin = await Admin.findOne({ where: { email } });
    if (!admin) {
      res.status(401).json({ status: 0, message: "Invalid credentials" });
      return;
    }

    const ok = await bcrypt.compare(
      String(password),
      String((admin as any).passwordHash),
    );
    if (!ok) {
      res.status(401).json({ status: 0, message: "Invalid credentials" });
      return;
    }

    const token = createToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + TOKEN_TTL_DAYS);

    await AdminSession.create({
      adminId: (admin as any).id,
      token,
      expiresAt,
    });

    res.status(200).json({ status: 1, token, expiresAt });
  } catch (e) {
    console.error("Admin login error:", e);
    res.status(500).json({ status: 0, message: "Server error" });
  }
};

export const adminUserGrowth = async (req: Request, res: Response) => {
  try {
    await User.sequelize?.query(
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS strikes INTEGER DEFAULT 0;",
    );

    const period =
      (req.query.period as "day" | "week" | "month" | "year") || "day";
    const now = new Date();
    let startDate: Date;
    let groupBy: string;
    let selectGroupBy: string;
    let reportsGroupBy: string;
    let reportsSelectGroupBy: string;
    let rawGroupBy: string; // ✅ NEW: for raw SQL queries using alias `u`

    switch (period) {
      case "day":
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
        groupBy = 'DATE_TRUNC(\'day\', "User"."createdAt")';
        selectGroupBy = 'DATE_TRUNC(\'day\', "User"."createdAt")';
        reportsGroupBy = "DATE_TRUNC('day', \"createdAt\")";
        reportsSelectGroupBy = "DATE_TRUNC('day', \"createdAt\")";
        rawGroupBy = "DATE_TRUNC('day', u.\"createdAt\")"; // ✅
        break;
      case "week":
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 28);
        groupBy = 'DATE_TRUNC(\'week\', "User"."createdAt")';
        selectGroupBy = 'DATE_TRUNC(\'week\', "User"."createdAt")';
        reportsGroupBy = "DATE_TRUNC('week', \"createdAt\")";
        reportsSelectGroupBy = "DATE_TRUNC('week', \"createdAt\")";
        rawGroupBy = "DATE_TRUNC('week', u.\"createdAt\")"; // ✅
        break;
      case "month":
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
        groupBy = 'DATE_TRUNC(\'month\', "User"."createdAt")';
        selectGroupBy = 'DATE_TRUNC(\'month\', "User"."createdAt")';
        reportsGroupBy = "DATE_TRUNC('month', \"createdAt\")";
        reportsSelectGroupBy = "DATE_TRUNC('month', \"createdAt\")";
        rawGroupBy = "DATE_TRUNC('month', u.\"createdAt\")"; // ✅
        break;
      case "year":
        startDate = new Date(now.getFullYear() - 5, 0, 1);
        groupBy = 'DATE_TRUNC(\'year\', "User"."createdAt")';
        selectGroupBy = 'DATE_TRUNC(\'year\', "User"."createdAt")';
        reportsGroupBy = "DATE_TRUNC('year', \"createdAt\")";
        reportsSelectGroupBy = "DATE_TRUNC('year', \"createdAt\")";
        rawGroupBy = "DATE_TRUNC('year', u.\"createdAt\")"; // ✅
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
        groupBy = 'DATE_TRUNC(\'day\', "User"."createdAt")';
        selectGroupBy = 'DATE_TRUNC(\'day\', "User"."createdAt")';
        reportsGroupBy = "DATE_TRUNC('day', \"createdAt\")";
        reportsSelectGroupBy = "DATE_TRUNC('day', \"createdAt\")";
        rawGroupBy = "DATE_TRUNC('day', u.\"createdAt\")"; // ✅
    }

    const newUsersData = (await User.findAll({
      where: {
        createdAt: { [Op.gte]: startDate },
        IsVerified: true,
        aproved: "YES",
      },
      attributes: [
        [literal(selectGroupBy), "period"],
        [fn("COUNT", col("id")), "count"],
      ],
      group: [literal(groupBy)] as any,
      raw: true,
    })) as any[];

    const reportedUsersData = (await User.sequelize!.query(
      `
      SELECT ${reportsSelectGroupBy} as period, COUNT(*) as count
      FROM reports
      WHERE "createdAt" >= :startDate
      GROUP BY ${reportsGroupBy}
      ORDER BY period
    `,
      {
        replacements: { startDate: startDate.toISOString() },
        type: QueryTypes.SELECT,
      },
    )) as any[];

    // ✅ FIXED: replaced "User"."createdAt" with u."createdAt" via rawGroupBy
    const matchedUsersData = (await User.sequelize!.query(
      `
      SELECT ${rawGroupBy} as period, COUNT(DISTINCT u.id) as count
      FROM users u
      INNER JOIN matches m ON u.id = m.user_id
      WHERE u."createdAt" >= :startDate
        AND u."IsVerified" = true
        AND u."aproved" = 'YES'
        AND m.status = 'like'
        AND EXISTS (
          SELECT 1 FROM matches m2
          WHERE m2.user_id = m.matched_user_id
            AND m2.matched_user_id = m.user_id
            AND m2.status = 'like'
        )
      GROUP BY ${rawGroupBy}
      ORDER BY period
    `,
      {
        replacements: { startDate: startDate.toISOString() },
        type: QueryTypes.SELECT,
      },
    )) as any[];

    const chartData: any[] = [];
    const allPeriods = new Set<string>();

    newUsersData.forEach((item: any) => allPeriods.add(item.period));
    reportedUsersData.forEach((item: any) => allPeriods.add(item.period));
    matchedUsersData.forEach((item: any) => allPeriods.add(item.period));

    allPeriods.forEach((period: string) => {
      const newUsers = newUsersData.find((item: any) => item.period === period)?.count || 0;
      const reportedUsers = reportedUsersData.find((item: any) => item.period === period)?.count || 0;
      const matchedUsers = matchedUsersData.find((item: any) => item.period === period)?.count || 0;

      chartData.push({
        date: period,
        newUsers: Number(newUsers),
        reportedUsers: Number(reportedUsers),
        matchedUsers: Number(matchedUsers),
      });
    });

    chartData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    res.status(200).json(chartData);
  } catch (e) {
    console.error("Admin user growth error:", e);
    res.status(500).json({ status: 0, message: "Server error" });
  }
};
export const adminStats = async (req: Request, res: Response) => {
  try {
    // Ensure strikes column exists
    await User.sequelize?.query(
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS strikes INTEGER DEFAULT 0;",
    );

    const verifiedWhere = { IsVerified: true, aproved: "YES" };
    const totalUsers = await User.count({ where: verifiedWhere });

    const activeSince = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const activeUsers = await User.count({
      where: {
        lastActiveAt: { [Op.gte]: activeSince },
        ...verifiedWhere,
      } as any,
    });

    const blockedUsers = await User.count({
      where: {
        isBlocked: true,
        ...verifiedWhere,
      } as any,
    });

    const reportedUsers = await Report.count({
      distinct: true,
      col: "reported_user_id" as any,
    });
    const totalReports = await Report.count();

    const totalContacts = await ContactMessage.count();

    const totalStrikes =
      (await User.sum("strikes", {
        where: {
          strikes: { [Op.gt]: 0 },
          ...verifiedWhere,
        },
      } as any)) || 0;

    // Count users with mutual matches (both users liked each other)
    const totalMatchedPeopleResult = (await User.sequelize!.query(
      `
      SELECT COUNT(DISTINCT u.id) as count
      FROM users u
      INNER JOIN matches m ON u.id = m.user_id
      WHERE u."IsVerified" = true
        AND u."aproved" = 'YES'
        AND m.status = 'like'
        AND EXISTS (
          SELECT 1 FROM matches m2
          WHERE m2.user_id = m.matched_user_id
            AND m2.matched_user_id = m.user_id
            AND m2.status = 'like'
        )
    `,
      { type: QueryTypes.SELECT },
    )) as any[];

    const matchedPeopleCount = totalMatchedPeopleResult?.[0]?.count || 0;

    res.status(200).json({
      totalUsers,
      activeUsers24h: activeUsers,
      blockedUsers,
      reportedUsers,
      totalReports,
      totalContacts,
      totalStrikes,
      totalMatchedPeople: matchedPeopleCount,
    });
  } catch (e) {
    console.error("Admin stats error:", e);
    res.status(500).json({ status: 0, message: "Server error" });
  }
};

export const adminListUsers = async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

    const where: any = {
      IsVerified: true,
      aproved: "YES",
    };
    if (q) {
      where[Op.and] = [
        (where[Op.or] = [
          { email: { [Op.iLike]: `%${q}%` } },
          { phone: { [Op.iLike]: `%${q}%` } },
          { f_name: { [Op.iLike]: `%${q}%` } },
          { l_name: { [Op.iLike]: `%${q}%` } },
        ]),
      ];
    }

    const users = await User.findAll({
      where,
      order: [["createdAt", "DESC"]],
      limit,
      offset,
      attributes: {
        exclude: ["password", "OTP", "OTPExpiry"],
      },
      include: [
        {
          model: (await import("../models/AIPromptMatching")).default,
          as: "aiPrompt",
          attributes: ["prompt", "isEnabled", "lastUpdated"],
        },
      ],
    });

    // Transform to include AI prompt fields
    const usersWithPrompt = users.map((u: any) => {
      const json = u.toJSON();
      return {
        ...json,
        hasAIPrompt: !!json.aiPrompt?.prompt,
        aiPrompt: json.aiPrompt?.prompt || null,
        aiPromptLastUpdated: json.aiPrompt?.lastUpdated || null,
        aiPromptEnabled: json.aiPrompt?.isEnabled || false,
      };
    });

    res.status(200).json(usersWithPrompt);
  } catch (e) {
    console.error("Admin list users error:", e);
    res.status(500).json({ status: 0, message: "Server error" });
  }
};

export const adminSetUserBlocked = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.params.id);
    const isBlocked = Boolean(req.body?.isBlocked);

    if (!userId) {
      res.status(400).json({ status: 0, message: "Invalid user id" });
      return;
    }

    const user = await User.findByPk(userId);
    if (!user) {
      res.status(404).json({ status: 0, message: "User not found" });
      return;
    }

    await user.update({ isBlocked } as any);

    // Send email notification to user
    const userEmail = String((user as any).email || "");
    if (userEmail) {
      if (isBlocked) {
        void sendBlockedEmail(userEmail, "Violation of community guidelines");
      } else {
        void sendUnblockedEmail(userEmail);
      }
    }

    res.status(200).json({ status: 1 });
  } catch (e) {
    console.error("Admin block user error:", e);
    res.status(500).json({ status: 0, message: "Server error" });
  }
};

export const adminDeleteUser = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.params.id);
    if (!userId) {
      res.status(400).json({ status: 0, message: "Invalid user id" });
      return;
    }

    const user = await User.findByPk(userId);
    if (!user) {
      res.status(404).json({ status: 0, message: "User not found" });
      return;
    }

    // Cascade delete all associated data
    await Match.destroy({
      where: {
        [Op.or]: [{ user_id: userId }, { matched_user_id: userId }],
      } as any,
    });
    await Message.destroy({
      where: {
        [Op.or]: [{ sender_id: userId }, { receiver_id: userId }],
      } as any,
    });
    await Notification.destroy({
      where: { [Op.or]: [{ user_id: userId }, { sender_id: userId }] } as any,
    });
    await PushToken.destroy({ where: { user_id: userId } as any });
    await CallLog.destroy({
      where: { [Op.or]: [{ caller_id: userId }, { callee_id: userId }] } as any,
    });
    await Report.destroy({
      where: {
        [Op.or]: [{ reporter_id: userId }, { reported_user_id: userId }],
      } as any,
    });

    // Ensure RBAC assignments are removed (some environments may not enforce FK cascade)
    await UserRole.destroy({ where: { userId } });

    await user.destroy();
    res.status(200).json({ status: 1 });
  } catch (e) {
    console.error("Admin delete user error:", e);
    res.status(500).json({ status: 0, message: "Server error" });
  }
};

export const adminReportsSummary = async (_req: Request, res: Response) => {
  try {
    // Ensure strikes column exists
    await User.sequelize?.query(
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS strikes INTEGER DEFAULT 0;",
    );

    const grouped = await Report.findAll({
      attributes: [
        "reported_user_id",
        [fn("COUNT", col("id")), "count"],
        [fn("MAX", col("createdAt")), "lastReportAt"],
      ],
      group: ["reported_user_id"],
      order: [[fn("COUNT", col("id")), "DESC"]],
      limit: 200,
      raw: true,
    });

    const rows = await Promise.all(
      (grouped as any[]).map(async (g) => {
        const userId = Number(g.reported_user_id);
        const user = await User.findByPk(userId, {
          attributes: [
            "id",
            "email",
            "phone",
            "f_name",
            "l_name",
            "isBlocked",
            "strikes",
            "lastActiveAt",
            "createdAt",
          ],
        });

        const latestReport = await Report.findOne({
          where: { reported_user_id: userId } as any,
          order: [["createdAt", "DESC"]],
          raw: true,
        });

        const reporterId = latestReport
          ? Number((latestReport as any).reporter_id)
          : null;
        const reporter = reporterId
          ? await User.findByPk(reporterId, {
              attributes: ["id", "email", "phone", "f_name", "l_name"],
            })
          : null;

        return {
          reported_user_id: userId,
          count: Number(g.count),
          lastReportAt: g.lastReportAt,
          lastReportType: latestReport
            ? (latestReport as any).report_type
            : null,
          lastReporter: reporter,
          user,
        };
      }),
    );

    res.status(200).json(rows);
  } catch (e) {
    console.error("Admin reports summary error:", e);
    res.status(500).json({ status: 0, message: "Server error" });
  }
};

export const adminWarnReportedUser = async (req: Request, res: Response) => {
  try {
    // Ensure strikes column exists
    await User.sequelize?.query(
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS strikes INTEGER DEFAULT 0;",
    );

    const userId = Number(req.params.id);
    const reason = String(
      req.body?.reason ||
        req.body?.reportType ||
        "Violation of community guidelines",
    );

    if (!userId) {
      res.status(400).json({ status: 0, message: "Invalid user id" });
      return;
    }

    const user = await User.findByPk(userId);
    if (!user) {
      res.status(404).json({ status: 0, message: "User not found" });
      return;
    }

    const nextStrikes = Number((user as any).strikes || 0) + 1;
    await user.update({ strikes: nextStrikes } as any);

    const emailed = await sendWarningEmail(
      String((user as any).email),
      nextStrikes,
      reason,
    );

    res.status(200).json({
      status: 1,
      strikes: nextStrikes,
      emailed,
      canBlock: nextStrikes >= 3,
    });
  } catch (e) {
    console.error("Admin warn user error:", e);
    res.status(500).json({ status: 0, message: "Server error" });
  }
};

export const adminBlockReportedUser = async (req: Request, res: Response) => {
  try {
    // Ensure strikes column exists
    await User.sequelize?.query(
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS strikes INTEGER DEFAULT 0;",
    );

    const userId = Number(req.params.id);
    const reason = String(req.body?.reason || "Repeated violations");

    if (!userId) {
      res.status(400).json({ status: 0, message: "Invalid user id" });
      return;
    }

    const user = await User.findByPk(userId);
    if (!user) {
      res.status(404).json({ status: 0, message: "User not found" });
      return;
    }

    await user.update({ isBlocked: true } as any);
    const emailed = await sendBlockedEmail(String((user as any).email), reason);

    res.status(200).json({ status: 1, emailed });
  } catch (e) {
    console.error("Admin block user error:", e);
    res.status(500).json({ status: 0, message: "Server error" });
  }
};

/**
 * Get pending photo reviews for admin
 */
export const adminListPendingPhotos = async (req: Request, res: Response) => {
  try {
    const users = await User.findAll({
      where: { photoStatus: "pending", aproved: "YES" },
      attributes: [
        "id",
        "email",
        "f_name",
        "l_name",
        "photoStatus",
        "profile",
        "im1",
        "im2",
        "im3",
        "im4",
      ],
      include: [
        {
          model: UserPhotoReview,
          as: "photoReview",
          required: false,
          attributes: ["photoSubmittedAt", "photoRejectReason"],
        },
      ],
      order: [
        [
          { model: UserPhotoReview, as: "photoReview" },
          "photoSubmittedAt",
          "ASC",
        ],
      ],
    });

    // Format for frontend
    const formatted = users.map((u) => ({
      id: u.id,
      email: u.email,
      f_name: u.f_name,
      l_name: u.l_name,
      photoStatus: u.photoStatus,
      profile: u.profile,
      im1: u.im1,
      im2: u.im2,
      im3: u.im3,
      im4: u.im4,
      photoSubmittedAt: (u as any).photoReview?.photoSubmittedAt,
    }));

    res.status(200).json({ status: 1, users: formatted });
  } catch (e) {
    console.error("Admin list pending photos error:", e);
    res.status(500).json({ status: 0, message: "Server error" });
  }
};

/**
 * Get rejected photo reviews for admin
 */
export const adminListRejectedPhotos = async (req: Request, res: Response) => {
  try {
    const users = await User.findAll({
      where: { photoStatus: "rejected", aproved: "YES" },
      attributes: [
        "id",
        "email",
        "f_name",
        "l_name",
        "photoStatus",
        "profile",
        "im1",
        "im2",
        "im3",
        "im4",
      ],
      include: [
        {
          model: UserPhotoReview,
          as: "photoReview",
          required: false,
          attributes: [
            "photoRejectReason",
            "photoReviewedAt",
            "rejectionNotifiedAt",
          ],
        },
      ],
      order: [
        [
          { model: UserPhotoReview, as: "photoReview" },
          "photoReviewedAt",
          "DESC",
        ],
      ],
    });

    const formatted = users.map((u) => ({
      id: u.id,
      email: u.email,
      f_name: u.f_name,
      l_name: u.l_name,
      photoStatus: u.photoStatus,
      profile: u.profile,
      im1: u.im1,
      im2: u.im2,
      im3: u.im3,
      im4: u.im4,
      photoRejectReason: (u as any).photoReview?.photoRejectReason,
      photoReviewedAt: (u as any).photoReview?.photoReviewedAt,
      rejectionNotifiedAt: (u as any).photoReview?.rejectionNotifiedAt,
    }));

    res.status(200).json({ status: 1, users: formatted });
  } catch (e) {
    console.error("Admin list rejected photos error:", e);
    res.status(500).json({ status: 0, message: "Server error" });
  }
};

/**
 * Review a user's photo (approve or reject)
 */
export const adminReviewPhoto = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.params.id);
    const { action, reason } = req.body;
    const adminId = (req as any).admin?.id || 1;

    if (!userId || !action) {
      res.status(400).json({ status: 0, message: "Missing user id or action" });
      return;
    }

    if (!["approve", "reject"].includes(action)) {
      res.status(400).json({ status: 0, message: "Invalid action" });
      return;
    }

    const user = await User.findByPk(userId);
    if (!user) {
      res.status(404).json({ status: 0, message: "User not found" });
      return;
    }

    if (action === "reject" && !reason) {
      res.status(400).json({ status: 0, message: "Rejection reason required" });
      return;
    }

    if (action === "approve") {
      await approveUserPhoto(userId, adminId);
      res
        .status(200)
        .json({ status: 1, message: "Photo approved successfully" });
    } else {
      await rejectUserPhoto(userId, adminId, reason);
      await sendRejectionNotifications(user, reason);
      res
        .status(200)
        .json({ status: 1, message: "Photo rejected and user notified" });
    }
  } catch (e: any) {
    console.error("Admin review photo error:", e);
    console.error("Error message:", e?.message);
    console.error("Error stack:", e?.stack);
    res
      .status(500)
      .json({ status: 0, message: "Server error", error: e?.message });
  }
};
