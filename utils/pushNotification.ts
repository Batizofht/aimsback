import { Expo } from "expo-server-sdk";
import PushToken from "../models/PushToken";

const expo = new Expo();

export const sendPushNotification = async (userId: number, title: string, body: string, data?: any) => {
  try {
    // Get all push tokens for the user
    const tokens = await PushToken.findAll({
      where: { user_id: userId },
    });

    if (tokens.length === 0) {
      return { success: false, message: "No push tokens found for user" };
    }

    const messages = tokens.map((token) => ({
      to: token.token,
      sound: "default",
      title,
      body,
      data: data || {},
    }));

    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error("Error sending push notification:", error);
      }
    }

    return { success: true, tickets };
  } catch (error) {
    console.error("Push notification error:", error);
    return { success: false, error };
  }
};

export const sendPushNotificationToToken = async (token: string, title: string, body: string, data?: any) => {
  try {
    if (!Expo.isExpoPushToken(token)) {
      return { success: false, message: "Invalid Expo push token" };
    }

    const message = {
      to: token,
      sound: "default",
      title,
      body,
      data: data || {},
    };

    const ticket = await expo.sendPushNotificationsAsync([message]);
    return { success: true, ticket };
  } catch (error) {
    console.error("Push notification error:", error);
    return { success: false, error };
  }
};

