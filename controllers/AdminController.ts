import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import Admin from "../models/Admin";

export const list = async (req: Request, res: Response) => {
  try {
    const admins = await Admin.findAll({
      attributes: ["id", "email", "f_name", "l_name", "role", "isActive", "lastLoginAt", "createdAt"],
      order: [["createdAt", "DESC"]],
    });
    res.json(admins);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const create = async (req: Request, res: Response) => {
  try {
    const { email, password, f_name, l_name, role } = req.body;
    if (!email || !password || !role) return res.status(400).json({ error: "Email, password, and role required" });

    const existing = await Admin.findOne({ where: { email } });
    if (existing) return res.status(409).json({ error: "Admin with this email already exists" });

    const hash = await bcrypt.hash(password, 10);
    const admin = await Admin.create({ email, passwordHash: hash, f_name, l_name, role });
    res.json({ id: admin.id, email: admin.email, f_name: admin.f_name, l_name: admin.l_name, role: admin.role });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const update = async (req: Request, res: Response) => {
  try {
    const { id, role, isActive } = req.body;
    if (!id) return res.status(400).json({ error: "Admin ID required" });

    const admin = await Admin.findByPk(id);
    if (!admin) return res.status(404).json({ error: "Admin not found" });

    const updateData: any = {};
    if (role) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = isActive;

    await admin.update(updateData);
    res.json({ id: admin.id, email: admin.email, f_name: admin.f_name, l_name: admin.l_name, role: admin.role, isActive: admin.isActive });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};