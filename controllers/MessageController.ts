import { Request, Response } from "express";
import Conversation from "../models/Conversation";
import ChatMessage from "../models/ChatMessage";
import { addSystemMessage } from "../utils/messages";

export const list = async (req: Request, res: Response) => {
  try {
    const conversations = await Conversation.findAll({ order: [["createdAt", "ASC"]] });
    const result = [];
    for (const conv of conversations) {
      const msgs = await ChatMessage.findAll({
        where: { conversationId: conv.id },
        order: [["createdAt", "ASC"]],
      });
      result.push({
        ...conv.toJSON(),
        messages: msgs.map(m => ({ from: m.from, text: m.text, time: m.time })),
      });
    }
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const reply = async (req: Request, res: Response) => {
  try {
    const { conversationId, from, text, time } = req.body;
    const conv = await Conversation.findByPk(conversationId);
    if (!conv) return res.status(404).json({ error: "Conversation not found" });

    const msgTime = time || new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    await ChatMessage.create({ conversationId, from, text, time: msgTime });

    const isStaff = from === "AIMS Capital Support" || from === "AIMS Capital";
    conv.lastMessage = text;
    conv.unread = !isStaff;
    conv.date = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    await conv.save();

    const msgs = await ChatMessage.findAll({
      where: { conversationId },
      order: [["createdAt", "ASC"]],
    });
    
    res.json({
      ...conv.toJSON(),
      messages: msgs.map(m => ({ from: m.from, text: m.text, time: m.time })),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const sendNotification = async (req: Request, res: Response) => {
  try {
    const { customerEmail, customerName, subject, text } = req.body;
    if (!customerEmail || !subject || !text) {
      return res.status(400).json({ error: "customerEmail, subject, and text required" });
    }
    await addSystemMessage(customerEmail, subject, text, customerName);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};