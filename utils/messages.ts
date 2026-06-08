import Conversation from "../models/Conversation";
import ChatMessage from "../models/ChatMessage";

export async function addSystemMessage(customerEmail: string, subject: string, text: string, customerName?: string) {
  const now = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const time = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  const displayName = customerName || customerEmail.split("@")[0];

  let conversation = await Conversation.findOne({ where: { customerEmail } });

  if (!conversation) {
    conversation = await Conversation.create({
      with: displayName,
      email: customerEmail,
      customerEmail,
      lastMessage: text,
      date: now,
      unread: true,
    });
    await ChatMessage.create({
      conversationId: conversation.id,
      from: "AIMS Capital Support",
      text: `📌 ${subject}\n\n${text}`,
      time,
    });
  } else {
    const msgTime = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    await ChatMessage.create({
      conversationId: conversation.id,
      from: "AIMS Capital Support",
      text: `📌 ${subject}\n\n${text}`,
      time: msgTime,
    });
    conversation.lastMessage = text;
    conversation.unread = true;
    conversation.date = now;
    await conversation.save();
  }
}