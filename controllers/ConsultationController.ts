import { Request, Response } from "express";
import Consultation from "../models/Consultation";
import { sendConsultationReplyEmail, sendConsultationMessageEmail, sendConsultationAutoReply, sendConsultationTeamNotification } from "../utils/email";
import { addSystemMessage } from "../utils/messages";

export const list = async (req: Request, res: Response) => {
  try {
    const items = await Consultation.findAll({ order: [["createdAt", "DESC"]] });
    res.json(items);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const create = async (req: Request, res: Response) => {
  try {
    const item = await Consultation.create({ ...req.body });
    console.log(`New consultation booking from ${item.name} (${item.email})`);
    sendConsultationAutoReply(item.email, item.name, item.date, item.time, item.platform).catch(() => {});
    sendConsultationTeamNotification(item.name, item.email, item.date, item.time, item.platform).catch(() => {});
    res.json(item);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const update = async (req: Request, res: Response) => {
  try {
    const item = await Consultation.findByPk(req.body.id);
    if (!item) return res.status(404).json({ error: "Not found" });
    await item.update(req.body);
    res.json(item);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const reply = async (req: Request, res: Response) => {
  try {
    const { id, message } = req.body;
    if (!message) return res.status(400).json({ error: "Reply message is required" });

    const item = await Consultation.findByPk(id);
    if (!item) return res.status(404).json({ error: "Not found" });

    const isFirst = !item.adminReply;
    await item.update({ adminReply: message, status: "confirmed" });

    if (isFirst) {
      await sendConsultationReplyEmail(item.email, item.name, message, item.date, item.time, item.platform);
      addSystemMessage(item.email, "Consultation Confirmed", message, item.name);
    } else {
      await sendConsultationMessageEmail(item.email, item.name, message);
      addSystemMessage(item.email, "Message Regarding Your Consultation", message, item.name);
    }

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};