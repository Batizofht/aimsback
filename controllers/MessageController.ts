import { Request, Response } from "express";
import Message from "../models/Message";
import User from "../models/User";
import Match from "../models/Match";
import { Op } from "sequelize";
import { saveBase64Image } from "../utils/imageUtils";
import { sendPushNotification } from "../utils/pushNotification";
import path from "path";
import fs from "fs";
import { moderateImage } from "../utils/imageModeration";

const isChatBlockedByFlag = async (userA: number, userB: number) => {
  const flagRecord = await Match.findOne({
    where: {
      status: "flag",
      [Op.or]: [
        { user_id: userA, matched_user_id: userB },
        { user_id: userB, matched_user_id: userA },
      ],
    },
  });

  return !!flagRecord;
};

const parseMessageDateFromClient = (
  dateValue: any,
  clientTimestampValue: any,
): Date => {
  const rawClientTs = Array.isArray(clientTimestampValue)
    ? clientTimestampValue[0]
    : clientTimestampValue;
  if (
    rawClientTs !== undefined &&
    rawClientTs !== null &&
    String(rawClientTs).trim() !== ""
  ) {
    const parsedTs = Number(rawClientTs);
    if (!Number.isNaN(parsedTs) && Number.isFinite(parsedTs) && parsedTs > 0) {
      const fromTs = new Date(parsedTs);
      if (!Number.isNaN(fromTs.getTime())) return fromTs;
    }
  }

  const rawDate = Array.isArray(dateValue) ? dateValue[0] : dateValue;
  if (rawDate) {
    const parsedDate = new Date(rawDate);
    if (!Number.isNaN(parsedDate.getTime())) return parsedDate;
  }

  return new Date();
};

// Send Message
export const sendMessage = async (req: Request, res: Response) => {
  try {
    const { user, rec, message, date, clientTimestamp, name } = req.body;

    if (!user || !rec || !message) {
      res.status(400).json({
        message: "User, receiver, and message are required",
        status: 0,
      });
      return;
    }

    const senderId = Number(user);
    const receiverId = Number(rec);
    const isBlocked = await isChatBlockedByFlag(senderId, receiverId);

    if (isBlocked) {
      res
        .status(403)
        .json({ message: "Chat is unavailable", status: 0, blocked: true });
      return;
    }

    const newmessage = await Message.create({
      sender_id: senderId,
      receiver_id: receiverId,
      message: message,
      date: parseMessageDateFromClient(date, clientTimestamp),
    });

    // Send push notification
    const sender = await User.findByPk(user);
    const receiver = await User.findByPk(rec);
    const senderName = sender?.f_name
      ? `${sender.f_name}${sender.l_name ? " " + sender.l_name : ""}`
      : name || "New Message";
    const isGif =
      typeof message === "string" &&
      (message.includes("giphy.com") || message.includes("giphy.gif"));
    const messagePreview = isGif ? "Sent a GIF 🎬" : message.substring(0, 50);
    console.log("🔔 Push check for user", rec, {
      hasReceiver: !!receiver,
      pushEnabled: receiver?.push,
      pushValue: receiver?.push,
    });
    if (receiver && receiver.push === "true") {
      await sendPushNotification(Number(rec), senderName, messagePreview, {
        type: "new_message",
      });
    }

    // Set newmessage flag for receiver
    if (receiver) {
      await receiver.update({ newmessage: true });
    }

    res
      .status(200)
      .json({ message: "Message sent", status: 1, messageId: newmessage.id });
  } catch (error: any) {
    console.error("Send message error:", error);
    res.status(500).json({ message: "Server error", status: 0 });
  }
};

// Send Message with Image
export const sendMessageImage = async (req: Request, res: Response) => {
  try {
    const { user, too, image, date, clientTimestamp, name } = req.body;

    if (!user || !too || !image) {
      return res.status(400).json({
        message: "User, receiver, and image are required",
        status: 0,
      });
    }

    const senderId = Number(user);
    const receiverId = Number(too);
    const isBlocked = await isChatBlockedByFlag(senderId, receiverId);

    if (isBlocked) {
      return res.status(403).json({
        message: "Chat is unavailable",
        status: 0,
        blocked: true,
      });
    }

    // 1️⃣ Save TEMP image
    const tempFilename = saveBase64Image(image, "temp", "msg-temp.jpg");
    const tempPath = path.join("uploads/temp", tempFilename);

    // 2️⃣ VERY STRICT moderation for messages
    const allowed = await moderateImage(tempPath, {
      allowShirtless: false, // 🚫 NEVER allowed in messages
    });

    if (!allowed) {
      fs.unlinkSync(tempPath); // 🔥 delete immediately
      return res.status(400).json({
        message: "This image is not allowed in messages.",
        status: 0,
      });
    }

    // 3️⃣ Save FINAL image
    const finalFilename = saveBase64Image(image, "messageimage", "message.jpg");

    // 4️⃣ Delete temp file
    fs.unlinkSync(tempPath);

    // 5️⃣ Create message
    const newmessage = await Message.create({
      sender_id: senderId,
      receiver_id: receiverId,
      message: finalFilename,
      date: parseMessageDateFromClient(date, clientTimestamp),
    });

    // 6️⃣ Push notification
    const sender = await User.findByPk(user);
    const receiver = await User.findByPk(too);
    const senderName = sender?.f_name
      ? `${sender.f_name}${sender.l_name ? " " + sender.l_name : ""}`
      : name || "New Message";
    if (receiver && receiver.push === "true") {
      await sendPushNotification(Number(too), senderName, "Sent you an image", {
        type: "new_message",
      });
    }

    res.status(200).json({
      message: "Image sent",
      status: 1,
      messageId: newmessage.id,
    });
  } catch (error: any) {
    console.error("Send message image error:", error);
    res.status(500).json({ message: "Server error", status: 0 });
  }
};

// In-memory store for typing status (ephemeral, perfect for single-server polling)
const typingStatuses = new Map<string, number>();

// Get Messages
export const getMessages = async (req: Request, res: Response) => {
  try {
    const { sender, user, page, limit, isTyping } = req.body;

    if (!sender || !user) {
      res
        .status(400)
        .json({ message: "Sender and user are required", status: 0 });
      return;
    }

    const senderId = Number(sender);
    const userId = Number(user);

    // Update typing status for current user -> sender
    const typingKey = `${userId}_${senderId}`;
    if (isTyping === "true" || isTyping === true) {
      typingStatuses.set(typingKey, Date.now());
    } else {
      typingStatuses.delete(typingKey);
    }

    // Check if peer (sender) is typing to us (user)
    const peerTypingKey = `${senderId}_${userId}`;
    const peerLastTypingAt = typingStatuses.get(peerTypingKey);
    const peerIsTyping = peerLastTypingAt
      ? Date.now() - peerLastTypingAt < 4000
      : false; // 4 seconds timeout

    const isBlocked = await isChatBlockedByFlag(senderId, userId);

    const pageNum = page ? Number(page) : 1;
    const limitNum = limit ? Number(limit) : 15; // default limit 15 as requested

    const queryOptions: any = {
      where: {
        [Op.or]: [
          { sender_id: senderId, receiver_id: userId },
          { sender_id: userId, receiver_id: senderId },
        ],
      },
      include: [
        {
          model: User,
          as: "sender",
          attributes: ["id", "f_name", "l_name", "profile"],
          required: false,
        },
      ],
      order: [["createdAt", "DESC"]], // Fetch newest first to get correct slice
    };

    if (limitNum > 0) {
      queryOptions.limit = limitNum;
      queryOptions.offset = (pageNum - 1) * limitNum;
    }

    let messages = await Message.findAll(queryOptions);
    messages = messages.reverse(); // Reverse so older messages are at the top, making it chronological ASC

    const messagesData = messages.map((msg) => {
      const data = msg.toJSON();
      // Fast timestamp extraction
      let messageDate = data.date || data.createdAt;

      return {
        msg_id: data.id,
        msg: data.message,
        date: messageDate, // Keep original date format, the client will parse it
        incoming_msg_id: data.sender_id,
        profile: (data as any).sender?.profile,
      };
    });

    if (isBlocked) {
      res
        .status(200)
        .json({ blocked: true, messages: messagesData, peerIsTyping: false });
      return;
    }

    res.status(200).json({ messages: messagesData, peerIsTyping });
  } catch (error: any) {
    console.error("Get messages error:", error);
    res.status(500).json({ message: "Server error", status: 0 });
  }
};

// Get Chat List (Users with messages + matched users)
export const getChatList = async (req: Request, res: Response) => {
  try {
    const { user } = req.body;

    if (!user) {
      res.status(400).json({ message: "User is required", status: 0 });
      return;
    }

    const userId = Number(user);

    // Get distinct users who have messages with current user
    const messages = await Message.findAll({
      where: {
        [Op.or]: [{ sender_id: userId }, { receiver_id: userId }],
      },
      attributes: ["sender_id", "receiver_id", "message", "createdAt"],
      order: [["createdAt", "DESC"]],
    });

    // Get unique user IDs from messages
    const messageUserIds = new Set<number>();
    messages.forEach((msg) => {
      if (msg.sender_id !== userId) messageUserIds.add(msg.sender_id);
      if (msg.receiver_id !== userId) messageUserIds.add(msg.receiver_id);
    });

    // Get all mutual matches (users who have matched with current user)
    const userMatches = await Match.findAll({
      where: {
        user_id: userId,
        status: "like",
      },
      attributes: ["matched_user_id"],
    });

    // Check for mutual matches
    const matchedUserIds = new Set<number>();
    for (const match of userMatches) {
      const reverseMatch = await Match.findOne({
        where: {
          user_id: match.matched_user_id,
          matched_user_id: userId,
          status: "like",
        },
      });

      if (reverseMatch) {
        matchedUserIds.add(match.matched_user_id);
      }
    }

    // Combine message users and matched users (matched users should appear even without messages)
    const allUserIds = new Set<number>();
    messageUserIds.forEach((id) => allUserIds.add(id));
    matchedUserIds.forEach((id) => allUserIds.add(id));

    // Get user details and last message
    const chatList = [];
    for (const userIdItem of allUserIds) {
      const chatUser = await User.findByPk(userIdItem);
      if (!chatUser) continue;

      // Find last message if exists
      const lastMessage = messages.find(
        (msg) =>
          (msg.sender_id === userIdItem && msg.receiver_id === userId) ||
          (msg.receiver_id === userIdItem && msg.sender_id === userId),
      );

      // If user has messages, use last message; if matched but no messages, use empty string
      const lastMessageText = lastMessage?.message || "";
      const lastMessageTime =
        (lastMessage as any)?.createdAt || (lastMessage as any)?.date || null;

      chatList.push({
        id: chatUser.id,
        f_name: chatUser.f_name,
        l_name: chatUser.l_name,
        profile: chatUser.profile,
        status: (chatUser as any).status,
        verificationStatus: chatUser.verificationStatus,
        last_message: lastMessageText,
        last_message_time: lastMessageTime,
        incoming_msg_id: lastMessage?.sender_id || null,
        im1:chatUser.im1
      });
    }

    // Sort by last message date (users with messages first, then matched users without messages)
    chatList.sort((a, b) => {
      const aHasMessage = a.last_message.length > 0;
      const bHasMessage = b.last_message.length > 0;

      if (aHasMessage && !bHasMessage) return -1;
      if (!aHasMessage && bHasMessage) return 1;

      // If both have messages or both don't, maintain order
      return 0;
    });

    res.status(200).json(chatList);
  } catch (error: any) {
    console.error("Get chat list error:", error);
    res.status(500).json({ message: "Server error", status: 0 });
  }
};

// Delete Message
export const deleteMessage = async (req: Request, res: Response) => {
  try {
    const { deletemessage } = req.query;
    console.log("deleteMessage called with:", deletemessage);
    const messageId = Number(deletemessage);

    if (!messageId) {
      res.status(400).json({ message: "Message ID is required", status: 0 });
      return;
    }

    const message = await Message.findByPk(messageId);
    if (!message) {
      res.status(404).json({ message: "Message not found", status: 0 });
      return;
    }

    await message.destroy();
    res.status(200).json({ message: "Message deleted", status: 1 });
  } catch (error: any) {
    console.error("Delete message error:", error);
    res.status(500).json({ message: "Server error", status: 0 });
  }
};

// Get User Status
export const getUserStatus = async (req: Request, res: Response) => {
  try {
    const { setStatusssss } = req.query;
    const userId = Number(setStatusssss);

    if (!userId) {
      res.status(400).json({ message: "User ID is required", status: 0 });
      return;
    }

    const user = await User.findByPk(userId, { attributes: ["status"] });
    res.status(200).json((user as any)?.status || "Offline");
  } catch (error: any) {
    console.error("Get user status error:", error);
    res.status(500).json({ message: "Server error", status: 0 });
  }
};

// Send Audio Message (multipart/form-data expected with field 'audio')
export const sendAudio = async (req: Request, res: Response) => {
  try {
    // multer stores file on disk and provides req.file
    const file = (req as any).file;
    const { user, rec, date, clientTimestamp, name } = req.body;

    console.log("sendAudio called, file present:", !!file, "body:", {
      user,
      rec,
      date,
      name,
    });

    if (!user || !rec || !file) {
      res.status(400).json({
        message: "User, receiver, and audio file are required",
        status: 0,
      });
      return;
    }

    const senderId = Number(user);
    const receiverId = Number(rec);
    const isBlocked = await isChatBlockedByFlag(senderId, receiverId);

    if (isBlocked) {
      res
        .status(403)
        .json({ message: "Chat is unavailable", status: 0, blocked: true });
      return;
    }

    const filename = file.filename;

    const newmessage = await Message.create({
      sender_id: senderId,
      receiver_id: receiverId,
      message: filename,
      date: parseMessageDateFromClient(date, clientTimestamp),
    });

    // Send push notification
    const sender = await User.findByPk(user);
    const receiver = await User.findByPk(rec);
    const senderName = sender?.f_name
      ? `${sender.f_name}${sender.l_name ? " " + sender.l_name : ""}`
      : name || "New Message";
    if (receiver && receiver.push === "true") {
      await sendPushNotification(
        Number(rec),
        senderName,
        "Sent you a voice message",
        {
          type: "new_message",
        },
      );
    }

    res
      .status(200)
      .json({ message: "Audio sent", status: 1, messageId: newmessage.id });
  } catch (error: any) {
    console.error("Send audio error:", error);
    res.status(500).json({ message: "Server error", status: 0 });
  }
};

// Reset newmessage flag
export const resetNewMessage = async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      res.status(400).json({ message: "User ID is required", status: 0 });
      return;
    }

    const user = await User.findByPk(userId);
    if (user) {
      await user.update({ newmessage: false });
    }

    res.status(200).json({ message: "New message flag reset", status: 1 });
  } catch (error: any) {
    console.error("Reset newmessage error:", error);
    res.status(500).json({ message: "Server error", status: 0 });
  }
};
