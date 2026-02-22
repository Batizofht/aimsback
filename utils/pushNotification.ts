import { Expo } from "expo-server-sdk";
import PushToken from "../models/PushToken";

const expo = new Expo({
  useFcmV1: true, // Use FCMv1 as configured in Expo dashboard
});

export const sendPushNotification = async (userId: number, title: string, body: string, data?: any) => {
  try {
    // Get all push tokens for the user
    const tokens = await PushToken.findAll({
      where: { user_id: userId },
    });

    console.log('🔔 Tokens for user', userId, ':', tokens.length, tokens.map(t => t.token));

    if (tokens.length === 0) {
      return { success: false, message: "No push tokens found for user" };
    }

    const messages = tokens.map((token) => {
      // Validate token format
      if (!Expo.isExpoPushToken(token.token)) {
        console.error('🔔 Invalid Expo push token:', token.token);
        return null;
      }
      return {
        to: token.token,
        sound: "default",
        title,
        body,
        data: data || {},
      };
    }).filter((message): message is NonNullable<typeof message> => message !== null);

    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
        console.log('🔔 Sent chunk, tickets:', ticketChunk);
      } catch (error) {
        console.error("Error sending push notification chunk:", error);
      }
    }

    // Check for any failed tickets
    const receiptIds = [];
    for (const ticket of tickets) {
      if (ticket.status === 'error') {
        console.error('🔔 Push notification error ticket:', ticket);
      } else if (ticket.status === 'ok') {
        console.log('🔔 Push notification sent successfully:', ticket);
        receiptIds.push(ticket.id);
      }
    }

    // Optionally check receipts (for debugging)
    if (receiptIds.length > 0) {
      setTimeout(async () => {
        try {
          const receiptIdChunks = expo.chunkPushNotificationReceiptIds(receiptIds);
          for (const chunk of receiptIdChunks) {
            const receipts = await expo.getPushNotificationReceiptsAsync(chunk);
            console.log('🔔 Receipts:', receipts);
            for (const receiptId in receipts) {
              const { status, message, details } = receipts[receiptId];
              if (status === 'error') {
                console.error(`🔔 Delivery error: ${message}`, details);
              }
            }
          }
        } catch (error) {
          console.error('🔔 Error checking receipts:', error);
        }
      }, 5000); // Check receipts after 5 seconds
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

