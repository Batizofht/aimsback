import { Request, Response } from "express";
import Conversation from "../models/Conversation";
import ChatMessage from "../models/ChatMessage";
import Member from "../models/Member";
import { addSystemMessage } from "../utils/messages";

export const list = async (req: Request, res: Response) => {
  try {
    const email = req.query.email as string | undefined;
    
    // If email is provided, validate it belongs to an active member
    if (email) {
      const member = await Member.findOne({ where: { email } });
      if (!member) {
        return res.status(404).json({ error: "Member not found" });
      }
      if (member.status !== "active") {
        return res.status(403).json({ error: "Only active members can access messages" });
      }
    }
    
    const conversations = await Conversation.findAll({ order: [["createdAt", "ASC"]] });
    const result = [];
    
    for (const conv of conversations) {
      // If email filter is provided, only show conversations for that member
      if (email && conv.customerEmail !== email) continue;
      
      // Validate conversation belongs to a registered active member
      const member = await Member.findOne({ where: { email: conv.customerEmail } });
      if (!member) continue; // Skip conversations from non-members
      if (member.status !== "active") continue; // Skip conversations from non-active members
      
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

    const isStaff = from === "AIMS Capital Support" || from === "AIMS Capital";
    
    // If not staff, validate the sender is an active member
    if (!isStaff) {
      const member = await Member.findOne({ where: { email: conv.customerEmail } });
      if (!member) {
        return res.status(404).json({ error: "Member not found" });
      }
      if (member.status !== "active") {
        return res.status(403).json({ error: "Only active members can send messages" });
      }
      // Ensure the sender name matches the registered member
      if (from !== member.name) {
        return res.status(403).json({ error: "Sender name does not match member name" });
      }
    }

    const msgTime = time || new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    await ChatMessage.create({ conversationId, from, text, time: msgTime });

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
    
    // Validate the customer is an active member
    const member = await Member.findOne({ where: { email: customerEmail } });
    if (!member) {
      return res.status(404).json({ error: "Member not found" });
    }
    if (member.status !== "active") {
      return res.status(403).json({ error: "Only active members can receive messages" });
    }
    
    await addSystemMessage(customerEmail, subject, text, customerName || member.name);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};