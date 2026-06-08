import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import Member from "../models/Member";
import { sendMembershipApprovedEmail, sendMembershipRejectedEmail } from "../utils/email";
import { addSystemMessage } from "../utils/messages";

export const list = async (req: Request, res: Response) => {
  try {
    const items = await Member.findAll({ order: [["createdAt", "DESC"]] });
    res.json(items);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const update = async (req: Request, res: Response) => {
  try {
    const item = await Member.findByPk(req.body.id);
    if (!item) return res.status(404).json({ error: "Not found" });
    await item.update(req.body);
    res.json(item);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, password, membershipType } = req.body;
    if (!name || !email || !password || !membershipType) {
      return res.status(400).json({ error: "Name, email, password, and membershipType required" });
    }

    const existing = await Member.findOne({ where: { email } });
    if (existing) return res.status(409).json({ error: "Email already registered" });

    const hash = await bcrypt.hash(password, 10);
    const joined = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const member = await Member.create({
      name,
      email,
      passwordHash: hash,
      membershipType,
      joined,
      status: "pending",
    } as any);

    res.json({
      id: member.id,
      name: member.name,
      email: member.email,
      membershipType: member.membershipType,
      status: member.status,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const getMe = async (req: Request, res: Response) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: "Email required" });
    const member = await Member.findOne({ where: { email: String(email) } });
    if (!member) return res.status(404).json({ error: "Not found" });
    res.json({
      id: member.id,
      name: member.name,
      email: member.email,
      phone: member.phone,
      membershipType: member.membershipType,
      status: member.status,
      rejectionReason: member.rejectionReason,
      joined: member.joined,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });

    const member = await Member.findOne({ where: { email } });
    if (!member) return res.status(401).json({ error: "Invalid credentials" });

    const match = await bcrypt.compare(password, member.passwordHash);
    if (!match) return res.status(401).json({ error: "Invalid credentials" });

    if (member.status === "pending") {
      return res.status(403).json({ error: "Your account is pending approval" });
    }

    res.json({
      id: member.id,
      name: member.name,
      email: member.email,
      phone: member.phone,
      membershipType: member.membershipType,
      status: member.status,
      rejectionReason: member.rejectionReason,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const approve = async (req: Request, res: Response) => {
  try {
    const { id } = req.body;
    const member = await Member.findByPk(id);
    if (!member) return res.status(404).json({ error: "Member not found" });

    await member.update({ status: "active", rejectionReason: null });
    await sendMembershipApprovedEmail(member.email, member.name);
    addSystemMessage(member.email, "Membership Approved", `Your AIMS Capital membership has been approved. You now have full access to book appointments, request services, and message your advisors.`, member.name);

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const resubmit = async (req: Request, res: Response) => {
  try {
    const { id } = req.body;
    const member = await Member.findByPk(id);
    if (!member) return res.status(404).json({ error: "Member not found" });
    if (member.status !== "suspended") return res.status(400).json({ error: "Only rejected members can re-submit" });

    await member.update({ status: "pending", rejectionReason: null });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const remove = async (req: Request, res: Response) => {
  try {
    const { id } = req.body;
    const member = await Member.findByPk(id);
    if (!member) return res.status(404).json({ error: "Member not found" });
    await member.destroy();
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const reject = async (req: Request, res: Response) => {
  try {
    const { id, reason } = req.body;
    if (!reason) return res.status(400).json({ error: "Rejection reason is required" });

    const member = await Member.findByPk(id);
    if (!member) return res.status(404).json({ error: "Member not found" });

    await member.update({ status: "suspended", rejectionReason: reason });
    await sendMembershipRejectedEmail(member.email, member.name, reason);
    addSystemMessage(member.email, "Membership Update", `Your membership application was not approved.\n\nReason: ${reason}\n\nYou can update your information and re-submit from your settings page.`, member.name);

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const changePassword = async (req: Request, res: Response) => {
  try {
    const { id, currentPassword, newPassword } = req.body;
    if (!id || !currentPassword || !newPassword) {
      return res.status(400).json({ error: "id, currentPassword, and newPassword required" });
    }

    const member = await Member.findByPk(id);
    if (!member) return res.status(404).json({ error: "Member not found" });

    const match = await bcrypt.compare(currentPassword, member.passwordHash);
    if (!match) return res.status(401).json({ error: "Current password is incorrect" });

    const hash = await bcrypt.hash(newPassword, 10);
    await member.update({ passwordHash: hash });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};