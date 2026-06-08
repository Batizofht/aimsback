import { Request, Response } from "express";
import ContactMessage from "../models/ContactMessage";
import { sendContactReplyEmail } from "../utils/email";
import { addSystemMessage } from "../utils/messages";

export const submit = async (req: Request, res: Response) => {
  try {
    const { name, email, subject, body } = req.body;
    if (!name || !email || !subject || !body) {
      return res.status(400).json({ error: "Name, email, subject, and body required" });
    }
    const msg = await ContactMessage.create({ name, email, subject, body, isRead: false, replied: false });
    console.log(`New contact message from ${name} (${email}): ${subject}`);
    res.json({ success: true, id: msg.id });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const list = async (req: Request, res: Response) => {
  try {
    const items = await ContactMessage.findAll({ order: [["createdAt", "DESC"]] });
    res.json(items);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const reply = async (req: Request, res: Response) => {
  try {
    const { id, message } = req.body;
    if (!message) return res.status(400).json({ error: "Reply message is required" });

    const item = await ContactMessage.findByPk(id);
    if (!item) return res.status(404).json({ error: "Not found" });

    await item.update({ isRead: true, replied: true, replyMessage: message, repliedAt: new Date() });
    await sendContactReplyEmail(item.email, item.name, message);
    addSystemMessage(item.email, "Response to Your Inquiry", message, item.name);

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};