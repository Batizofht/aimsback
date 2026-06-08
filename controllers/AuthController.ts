import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import Admin from "../models/Admin";

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });

    const admin = await Admin.findOne({ where: { email } });
    if (!admin) return res.status(401).json({ error: "Invalid credentials" });

    const match = await bcrypt.compare(password, admin.passwordHash);
    if (!match) return res.status(401).json({ error: "Invalid credentials" });

    await admin.update({ lastLoginAt: new Date() });

    res.json({
      id: admin.id,
      email: admin.email,
      f_name: admin.f_name,
      l_name: admin.l_name,
      role: admin.role,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const seedAdmin = async (req: Request, res: Response) => {
  try {
    const existing = await Admin.findOne({ where: { email: "admin@aimscapital.com" } });
    if (existing) return res.json({ message: "Admin already exists", id: existing.id });

    const hash = await bcrypt.hash("admin123", 10);
    const admin = await Admin.create({
      email: "admin@aimscapital.com",
      passwordHash: hash,
      f_name: "Super",
      l_name: "Admin",
      role: "admin",
    });
    res.json({ message: "Default admin created", id: admin.id, email: admin.email, role: admin.role });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};