import { Request, Response } from "express";
import User from "../models/User";
import Notification from "../models/Notification";
import SentEmail from "../models/SentEmail";
import NotificationCampaign from "../models/NotificationCampaign";
import { Op } from "sequelize";
import { sendCampaignEmail } from "../utils/emailCampaign";

// Campaign status type
type CampaignStatus = "draft" | "scheduled" | "sending" | "sent" | "failed";
type NotificationType = "push" | "email" | "both";
type RecipientType = "all" | "verified" | "premium" | "free" | "specific";

// Push notification sender (reusing existing logic)
const sendPushNotification = async (userId: number, title: string, body: string, data?: any) => {
  try {
    const PushToken = (await import("../models/PushToken")).default;
    const { Expo } = await import("expo-server-sdk");
    
    const tokens = await PushToken.findAll({
      where: { user_id: userId },
      order: [['updatedAt', 'DESC']],
    });

    if (tokens.length === 0) {
      return { success: false, error: "No push tokens found" };
    }

    const expo = new Expo();
    const messages: any[] = [];

    for (const tokenRecord of tokens) {
      const token = tokenRecord.token;
      if (!Expo.isExpoPushToken(token)) continue;

      messages.push({
        to: token,
        sound: "default",
        title,
        body,
        data: data || {},
        priority: "high",
        channelId: "default",
      });
    }

    if (messages.length === 0) {
      return { success: false, error: "No valid expo tokens" };
    }

    const chunks = expo.chunkPushNotifications(messages);
    const tickets: any[] = [];

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (e) {
        console.error("Push chunk error:", e);
      }
    }

    return { success: true, tickets };
  } catch (error) {
    console.error("Send push notification error:", error);
    return { success: false, error: String(error) };
  }
};


// Get users based on recipient type
const getTargetUsers = async (recipientType: RecipientType, specificIds?: number[]) => {
  const where: any = {
    aproved: "YES",
    IsVerified: true,
  };

  switch (recipientType) {
    case "verified":
      where.IsVerified = true;
      break;
    case "premium":
      where.subs = "PREMIUM";
      break;
    case "free":
      where.subs = { [Op.or]: [null, "", "BASIC"] };
      break;
    case "specific":
      if (specificIds && specificIds.length > 0) {
        where.id = { [Op.in]: specificIds };
      }
      break;
    case "all":
    default:
      break;
  }

  const users = await User.findAll({
    where,
    attributes: ['id', 'email', 'f_name', 'l_name', 'push'],
  });

  return users;
};

// Create notification campaign
export const createCampaign = async (req: Request, res: Response) => {
  try {
    const {
      title,
      message,
      type,
      recipientType,
      scheduledAt,
      specificUserIds,
      sendNow,
    } = req.body;

    if (!title || !message || !type || !recipientType) {
      res.status(400).json({ message: "Missing required fields", status: 0 });
      return;
    }

    // Get target users count
    const targetUsers = await getTargetUsers(recipientType, specificUserIds);

    const shouldSendNow = sendNow !== false && !scheduledAt;
    const adminId = (req as any).admin?.id;
    const campaign = await NotificationCampaign.create({
      title,
      message,
      type: type as NotificationType,
      status: (scheduledAt ? "scheduled" : "draft") as CampaignStatus,
      recipientType: recipientType as RecipientType,
      recipientCount: targetUsers.length,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      sentAt: null,
      createdBy: (req as any).admin?.email || "admin",
      createdById: adminId ?? null,
      sentCount: 0,
      failedCount: 0,
      specificUserIds: specificUserIds || [],
    } as any);

    if (shouldSendNow) {
      sendCampaignNotifications((campaign as any).id, adminId);
    }

    res.status(201).json({
      message: scheduledAt
        ? "Campaign scheduled"
        : shouldSendNow
        ? "Campaign created and sending"
        : "Campaign saved as draft",
      status: 1,
      campaign,
    });
  } catch (error: any) {
    console.error("Create campaign error:", error);
    res.status(500).json({ message: "Server error", status: 0, error: error.message });
  }
};

// Get all campaigns
export const getCampaigns = async (req: Request, res: Response) => {
  try {
    const allCampaigns = await NotificationCampaign.findAll({
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json({
      status: 1,
      campaigns: allCampaigns,
    });
  } catch (error: any) {
    console.error("Get campaigns error:", error);
    res.status(500).json({ message: "Server error", status: 0, error: error.message });
  }
};

// Get sent emails for a campaign
export const getSentEmails = async (req: Request, res: Response) => {
  try {
    const campaignIdRaw = (req.params as any).campaignId ?? (req.params as any).id;
    const campaignId = parseInt(String(campaignIdRaw));
    if (!Number.isFinite(campaignId)) {
      res.status(400).json({ message: "Invalid campaign id", status: 0 });
      return;
    }

    const limitRaw = parseInt(String((req.query as any).limit ?? "50"));
    const offsetRaw = parseInt(String((req.query as any).offset ?? "0"));
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50;
    const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0;
    
    const result = await SentEmail.findAndCountAll({
      where: { campaignId },
      order: [["sentAt", "DESC"]],
      limit,
      offset,
    });

    res.status(200).json({
      status: 1,
      total: result.count,
      limit,
      offset,
      emails: result.rows,
    });
  } catch (error: any) {
    console.error("Get sent emails error:", error);
    res.status(500).json({ message: "Server error", status: 0, error: error.message });
  }
};

// Delete campaign
export const deleteCampaign = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const campaignId = parseInt(id);

    const campaign = await NotificationCampaign.findByPk(campaignId);
    if (!campaign) {
      res.status(404).json({ message: "Campaign not found", status: 0 });
      return;
    }

    await campaign.destroy();
    res.status(200).json({ message: "Campaign deleted", status: 1 });
  } catch (error: any) {
    console.error("Delete campaign error:", error);
    res.status(500).json({ message: "Server error", status: 0, error: error.message });
  }
};

// Send campaign now (trigger scheduled or draft)
export const sendCampaignNow = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const campaignId = parseInt(id);

    const campaign: any = await NotificationCampaign.findByPk(campaignId);
    if (!campaign) {
      res.status(404).json({ message: "Campaign not found", status: 0 });
      return;
    }

    if (campaign.status === "sending") {
      res.status(400).json({ message: "Campaign already sending", status: 0 });
      return;
    }

    // Send in background
    sendCampaignNotifications(campaignId, campaign.createdById ?? undefined);

    res.status(200).json({
      message: "Campaign sending started",
      status: 1,
    });
  } catch (error: any) {
    console.error("Send campaign error:", error);
    res.status(500).json({ message: "Server error", status: 0, error: error.message });
  }
};

// Strip HTML tags to get plain text (for push notifications)
const stripHtml = (html: string): string => {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li>/gi, '• ')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

// Background function to send notifications
const sendCampaignNotifications = async (campaignId: number, senderId?: number) => {
  const campaign: any = await NotificationCampaign.findByPk(campaignId);
  if (!campaign) return;

  campaign.status = "sending";
  await campaign.save();

  try {
    const targetUsers = await getTargetUsers(campaign.recipientType, campaign.specificUserIds);
    
    let sentCount = 0;
    let failedCount = 0;

    // Process in batches to avoid overwhelming the server
    const BATCH_SIZE = 50;
    const batches = [];
    for (let i = 0; i < targetUsers.length; i += BATCH_SIZE) {
      batches.push(targetUsers.slice(i, i + BATCH_SIZE));
    }

    for (const batch of batches) {
      await Promise.all(
        batch.map(async (user: any) => {
          try {
            let pushOk = false;
            let emailOk = false;

            // Create in-app notification (use senderId if available, otherwise user_id as self-reference for system)
            await Notification.create({
              user_id: user.id,
              sender_id: senderId || user.id,
              title: campaign.title,
              message: stripHtml(campaign.message),
              status: "unread",
            } as any);

            // Send push if applicable
            if ((campaign.type === "push" || campaign.type === "both") && user.push === 'true') {
              const pushResult = await sendPushNotification(
                user.id,
                campaign.title,
                stripHtml(campaign.message),
                { type: 'campaign', campaignId: campaign.id }
              );
              pushOk = Boolean(pushResult.success);
            }

            // Send email if applicable
            if (campaign.type === "email" || campaign.type === "both") {
              try {
                const emailResult = await sendCampaignEmail(
                  user.email || "",
                  campaign.title,
                  campaign.message
                );
                emailOk = Boolean(emailResult);
                
                // Store email record in database
                await SentEmail.create({
                  campaignId: campaign.id,
                  userId: user.id,
                  email: user.email || "",
                  subject: campaign.title,
                  message: null,
                  status: emailOk ? 'sent' : 'failed'
                });
              } catch (emailError) {
                console.error(`Email storage error for user ${user.id}:`, emailError);
                emailOk = false;
              }
            }

            // Count results
            if (campaign.type === "both") {
              if (pushOk || emailOk) sentCount++;
              else failedCount++;
            } else if (campaign.type === "push") {
              if (pushOk) sentCount++;
              else failedCount++;
            } else if (campaign.type === "email") {
              if (emailOk) sentCount++;
              else failedCount++;
            }
          } catch (e) {
            console.error(`Failed to send to user ${user.id}:`, e);
            failedCount++;
          }
        })
      );

      // Small delay between batches
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    campaign.status = sentCount > 0 && failedCount === 0 ? "sent" : "failed";
    campaign.sentAt = new Date();
    campaign.sentCount = sentCount;
    campaign.failedCount = failedCount;
    await campaign.save();

    console.log(`[Campaign ${campaignId}] Sent: ${sentCount}, Failed: ${failedCount}`);
  } catch (error) {
    console.error(`[Campaign ${campaignId}] Error:`, error);
    campaign.status = "failed";
    await campaign.save();
  }
};

// Check and send scheduled campaigns (call this periodically)
export const processScheduledCampaigns = async () => {
  const now = new Date();

  const dueCampaigns: any[] = await NotificationCampaign.findAll({
    where: {
      status: "scheduled",
      scheduledAt: { [Op.lte]: now },
    },
  });

  for (const campaign of dueCampaigns) {
    console.log(`[Scheduler] Triggering campaign ${(campaign as any).id}`);
    sendCampaignNotifications((campaign as any).id, (campaign as any).createdById ?? undefined);
  }
};

// Run scheduler every minute
setInterval(processScheduledCampaigns, 60000);
