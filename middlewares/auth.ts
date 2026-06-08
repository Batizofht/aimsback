import { Request, Response, NextFunction } from "express";
import Admin from "../models/Admin";

export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }
  const adminId = parseInt(authHeader.substring(7));
  if (isNaN(adminId)) return res.status(401).json({ error: "Invalid token" });

  const admin = await Admin.findByPk(adminId);
  if (!admin || !admin.isActive) {
    return res.status(401).json({ error: "Invalid or inactive admin" });
  }
  (req as any).admin = admin;
  next();
};

export const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const admin = (req as any).admin;
    if (!admin) return res.status(401).json({ error: "Authentication required" });
    if (admin.role === "admin" || roles.includes(admin.role)) return next();
    return res.status(403).json({ error: "Insufficient permissions" });
  };
};