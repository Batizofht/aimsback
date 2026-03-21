import { Request, Response } from "express";
import Notification from "../models/Notification";
import User from "../models/User";
import { Op } from "sequelize";

// Get Notifications
export const getNotifications = async (req: Request, res: Response) => {
  try {
    const { user } = req.query;
    const userId = Number(user);

    if (!userId) {
      res.status(400).json({ message: "User ID is required", status: 0 });
      return;
    }

    const notifications = await Notification.findAll({
      where: { user_id: userId },
      include: [{
        model: User,
        as: 'sender',
        attributes: ['id', 'f_name', 'l_name', 'profile', 'verificationStatus'],
        required: false,
      }],
      order: [['createdAt', 'DESC']],
      limit: 50,
    });

    const notificationsData = notifications.map(notif => {
      const data = notif.toJSON();
      return {
        id: data.id,
        message: data.message,
        title: data.title,
        datesent: data.datesent || data.createdAt,
        senderid: data.sender_id,
        fname: data.sender?.f_name,
        sname: data.sender?.l_name,
        imageuser: data.sender?.profile,
        verificationStatus: data.sender?.verificationStatus,
        is_read: data.is_read || false,
      };
    });

    res.status(200).json(notificationsData);
  } catch (error: any) {
    console.error("Get notifications error:", error);
    res.status(500).json({ message: "Server error", status: 0 });
  }
};

// Get Notification Count
export const getNotificationCount = async (req: Request, res: Response) => {
  try {
    const { notification } = req.query;
    const userId = Number(notification);

    if (!userId) {
      res.status(400).json({ message: "User ID is required", status: 0 });
      return;
    }

    const count = await Notification.count({
      where: { user_id: userId, is_read: false },
    });

    // Return array of unread notifications
    const notifications = await Notification.findAll({
      where: { user_id: userId, is_read: false },
    });

    res.status(200).json(notifications);
  } catch (error: any) {
    console.error("Get notification count error:", error);
    res.status(500).json({ message: "Server error", status: 0 });
  }
};

// Delete All Notifications
export const deleteAllNotifications = async (req: Request, res: Response) => {
  try {
    const { deletenotification } = req.query;
    const userId = Number(deletenotification);

    if (!userId) {
      res.status(400).json({ message: "User ID is required", status: 0 });
      return;
    }

    await Notification.destroy({
      where: { user_id: userId },
    });

    res.status(200).json({ message: "Notifications deleted", status: 1 });
  } catch (error: any) {
    console.error("Delete notifications error:", error);
    res.status(500).json({ message: "Server error", status: 0 });
  }
};

// Delete single notification by id
export const deleteNotificationById = async (req: Request, res: Response) => {
  try {
    const { deletenotificationid } = req.query;
    const notifId = Number(deletenotificationid);

    if (!notifId) {
      res.status(400).json({ message: "Notification ID is required", status: 0 });
      return;
    }

    const notification = await Notification.findByPk(notifId);
    if (!notification) {
      res.status(404).json({ message: "Notification not found", status: 0 });
      return;
    }

    await notification.destroy();
    res.status(200).json({ message: "Notification deleted", status: 1 });
  } catch (error: any) {
    console.error("Delete notification error:", error);
    res.status(500).json({ message: "Server error", status: 0 });
  }
};

// Delete Notification Status (Mark as read)
export const deleteNotificationStatus = async (req: Request, res: Response) => {
  try {
    const { deletestattus } = req.query;
    const userId = Number(deletestattus);

    if (!userId) {
      res.status(400).json({ message: "User ID is required", status: 0 });
      return;
    }

    // Mark all notifications for this user as read
    await Notification.update({ is_read: true }, { where: { user_id: userId } });

    res.status(200).json({ message: "Notifications marked as read", status: 1 });
  } catch (error: any) {
    console.error("Delete notification status error:", error);
    res.status(500).json({ message: "Server error", status: 0 });
  }
};

// Save Push Token
export const savePushToken = async (req: Request, res: Response) => {
  try {
    const { user, token } = req.body;

    if (!user || !token) {
      res.status(400).json({ message: "User and token are required", status: 0 });
      return;
    }

    const PushToken = (await import("../models/PushToken")).default;

    // Use upsert to either create or update the token
    await PushToken.upsert({
      user_id: user,
      token: token,
    }, {
      conflictKeys: ['user_id', 'token'],
      updateFields: ['updatedAt']
    });

    res.status(200).json({ message: "Token saved", status: 1 });
  } catch (error: any) {
    console.error("Save push token error:", error);
    res.status(500).json({ message: "Server error", status: 0 });
  }
};

