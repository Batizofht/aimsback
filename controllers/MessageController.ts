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

// Send Message
export const sendMessage = async (req: Request, res: Response) => {
  try {
    const { user, rec, message, date, name } = req.body;

    if (!user || !rec || !message) {
      res.status(400).json({ message: "User, receiver, and message are required", status: 0 });
      return;
    }

    const newMessage = await Message.create({
      sender_id: user,
      receiver_id: rec,
      message: message,
      date: date ? new Date(date) : new Date(),
    });

    // Send push notification
    const receiver = await User.findByPk(rec);
    console.log('🔔 Push check for user', rec, {
      hasReceiver: !!receiver,
      pushEnabled: receiver?.push,
      pushValue: receiver?.push,
    });
    if (receiver && receiver.push === 'true') {
      await sendPushNotification(Number(rec), name || "New Message", message.substring(0, 50));
    }

    res.status(200).json({ message: "Message sent", status: 1, messageId: newMessage.id });
  } catch (error: any) {
    console.error("Send message error:", error);
    res.status(500).json({ message: "Server error", status: 0 });
  }
};

// Send Message with Image
export const sendMessageImage = async (req: Request, res: Response) => {
  try {
    const { user, too, image, date, name } = req.body;

    if (!user || !too || !image) {
      return res.status(400).json({
        message: "User, receiver, and image are required",
        status: 0
      });
    }

    // 1️⃣ Save TEMP image
    const tempFilename = saveBase64Image(image, "temp", "msg-temp.jpg");
    const tempPath = path.join("uploads/temp", tempFilename);

    // 2️⃣ VERY STRICT moderation for messages
    const allowed = await moderateImage(tempPath, {
      allowShirtless: false // 🚫 NEVER allowed in messages
    });

    if (!allowed) {
      fs.unlinkSync(tempPath); // 🔥 delete immediately
      return res.status(400).json({
        message: "This image is not allowed in messages.",
        status: 0
      });
    }

    // 3️⃣ Save FINAL image
    const finalFilename = saveBase64Image(image, "messageimage", "message.jpg");

    // 4️⃣ Delete temp file
    fs.unlinkSync(tempPath);

    // 5️⃣ Create message
    const newMessage = await Message.create({
      sender_id: user,
      receiver_id: too,
      message: finalFilename,
      date: date ? new Date(date) : new Date(),
    });

    // 6️⃣ Push notification
    const receiver = await User.findByPk(too);
    if (receiver && receiver.push === "true") {
      await sendPushNotification(
        Number(too),
        name || "New Message",
        "Sent you an image"
      );
    }

    res.status(200).json({
      message: "Image sent",
      status: 1,
      messageId: newMessage.id
    });

  } catch (error: any) {
    console.error("Send message image error:", error);
    res.status(500).json({ message: "Server error", status: 0 });
  }
};

// Get Messages
export const getMessages = async (req: Request, res: Response) => {
  try {
    const { sender, user } = req.body;

    if (!sender || !user) {
      res.status(400).json({ message: "Sender and user are required", status: 0 });
      return;
    }

    const messages = await Message.findAll({
      where: {
        [Op.or]: [
          { sender_id: sender, receiver_id: user },
          { sender_id: user, receiver_id: sender },
        ],
      },
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'f_name', 'l_name', 'profile'],
          required: false,
        },
      ],
      order: [['createdAt', 'ASC']],
    });

    const messagesData = messages.map(msg => {
      const data = msg.toJSON();
      // Ensure date is always in ISO format for consistent parsing
      let messageDate = data.date || data.createdAt;
      
      if (messageDate instanceof Date) {
        messageDate = messageDate.toISOString();
      } else if (typeof messageDate === 'string') {
        // Handle PostgreSQL timestamp format: "2025-12-24 11:58:33.698+00"
        // or ISO format, or custom format
        try {
          // If it's already ISO format (contains 'T'), use as is
          if (messageDate.includes('T')) {
            // Already ISO format
          } else if (messageDate.includes('+') || messageDate.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/)) {
            // PostgreSQL timestamp format: "2025-12-24 11:58:33.698+00"
            // Replace space with T and ensure proper format
            let cleaned = messageDate.replace(' ', 'T');
            // Remove timezone offset if present (moment will handle it)
            cleaned = cleaned.replace(/\+00(:00)?$/, '');
            const parsedDate = new Date(cleaned);
            if (!isNaN(parsedDate.getTime())) {
              messageDate = parsedDate.toISOString();
            } else {
              // Try parsing with moment-like format
              messageDate = cleaned + 'Z';
            }
          } else {
            // Try to parse as custom format or regular date
            const parsedDate = new Date(messageDate);
            if (!isNaN(parsedDate.getTime())) {
              messageDate = parsedDate.toISOString();
            }
          }
        } catch (e) {
          // If parsing fails, use createdAt as fallback
          messageDate = data.createdAt ? (data.createdAt instanceof Date ? data.createdAt.toISOString() : data.createdAt) : new Date().toISOString();
        }
      } else if (!messageDate) {
        // If no date, use createdAt or current time
        messageDate = data.createdAt ? (data.createdAt instanceof Date ? data.createdAt.toISOString() : data.createdAt) : new Date().toISOString();
      }
      
      return {
        msg_id: data.id,
        msg: data.message,
        date: messageDate,
        incoming_msg_id: data.sender_id,
        profile: data.sender?.profile,
      };
    });

    res.status(200).json(messagesData);
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
        [Op.or]: [
          { sender_id: userId },
          { receiver_id: userId },
        ],
      },
      attributes: ['sender_id', 'receiver_id', 'message', 'createdAt'],
      order: [['createdAt', 'DESC']],
    });

    // Get unique user IDs from messages
    const messageUserIds = new Set<number>();
    messages.forEach(msg => {
      if (msg.sender_id !== userId) messageUserIds.add(msg.sender_id);
      if (msg.receiver_id !== userId) messageUserIds.add(msg.receiver_id);
    });

    // Get all mutual matches (users who have matched with current user)
    const userMatches = await Match.findAll({
      where: {
        user_id: userId,
        status: 'like',
      },
      attributes: ['matched_user_id'],
    });

    // Check for mutual matches
    const matchedUserIds = new Set<number>();
    for (const match of userMatches) {
      const reverseMatch = await Match.findOne({
        where: {
          user_id: match.matched_user_id,
          matched_user_id: userId,
          status: 'like',
        },
      });

      if (reverseMatch) {
        matchedUserIds.add(match.matched_user_id);
      }
    }

    // Combine message users and matched users (matched users should appear even without messages)
    const allUserIds = new Set<number>();
    messageUserIds.forEach(id => allUserIds.add(id));
    matchedUserIds.forEach(id => allUserIds.add(id));

    // Get user details and last message
    const chatList = [];
    for (const userIdItem of allUserIds) {
      const chatUser = await User.findByPk(userIdItem);
      if (!chatUser) continue;

      // Find last message if exists
      const lastMessage = messages.find(msg =>
        (msg.sender_id === userIdItem && msg.receiver_id === userId) ||
        (msg.receiver_id === userIdItem && msg.sender_id === userId)
      );

      // If user has messages, use last message; if matched but no messages, use empty string
      const lastMessageText = lastMessage?.message || '';

      chatList.push({
        id: chatUser.id,
        f_name: chatUser.f_name,
        l_name: chatUser.l_name,
        profile: chatUser.profile,
        status: chatUser.status,
        last_message: lastMessageText,
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
    console.log('deleteMessage called with:', deletemessage);
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
    res.status(200).json(user?.status || "Offline");
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
    const { user, rec, date, name } = req.body;

    console.log('sendAudio called, file present:', !!file, 'body:', { user, rec, date, name });

    if (!user || !rec || !file) {
      res.status(400).json({ message: "User, receiver, and audio file are required", status: 0 });
      return;
    }

    const filename = file.filename;

    const newMessage = await Message.create({
      sender_id: Number(user),
      receiver_id: Number(rec),
      message: filename,
      date: date ? new Date(date) : new Date(),
    });

    // Send push notification
    const receiver = await User.findByPk(rec);
    if (receiver && receiver.push === 'true') {
      await sendPushNotification(Number(rec), name || "New Message", "Sent you a voice message");
    }

    res.status(200).json({ message: "Audio sent", status: 1, messageId: newMessage.id });
  } catch (error: any) {
    console.error("Send audio error:", error);
    res.status(500).json({ message: "Server error", status: 0 });
  }
};

