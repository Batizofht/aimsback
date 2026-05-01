import User from "../models/User";
import UserPhotoReview from "../models/UserPhotoReview";
import Match from "../models/Match";
import { sendPushNotification } from "./pushNotification";
import Notification from "../models/Notification";

/**
 * Set user photo to pending status
 * Called when user uploads a new photo
 */
export const setPhotoPending = async (userId: number): Promise<void> => {
  const user = await User.findByPk(userId);
  if (!user) return;

  // Do NOT reset to pending if the user is already approved.
  // This prevents unnecessary re-verification for existing users updating photos.
  if (user.get("photoStatus") === "approved") {
    return;
  }

  // Update user status
  await User.update({ photoStatus: "pending" }, { where: { id: userId } });

  // Upsert photo review record
  const [review, created] = await UserPhotoReview.findOrCreate({
    where: { userId },
    defaults: {
      userId,
      photoSubmittedAt: new Date(),
      heldNotifications: [],
    },
  });

  if (!created) {
    // Reset existing record
    await review.update({
      photoSubmittedAt: new Date(),
      photoRejectReason: null,
      heldNotifications: [],
    });
  }
};

/**
 * Queue notification for pending/rejected user
 * Returns true if queued, false if sent immediately
 */
export const queueOrSendNotification = async (
  userId: number,
  notification: {
    type: "like" | "match" | "message";
    fromUserId?: number;
    data?: any;
  },
): Promise<boolean> => {
  const user = await User.findByPk(userId);
  if (!user) return false;

  // Only deliver immediately when the profile is fully active:
  //   • photoStatus approved  (photos passed admin review)
  //   • email verified        (IsVerified)
  //   • profile approved      (aproved === 'YES')
  //   • not blocked
  const isFullyVerified =
    user.get("photoStatus") === "approved" &&
    user.get("IsVerified") === true &&
    String(user.get("aproved") ?? "").toUpperCase() === "YES" &&
    !user.get("isBlocked");

  if (isFullyVerified) {
    return false; // Caller should send immediately
  }

  // Queue for pending / rejected / unverified users.
  // Use findOrCreate so we never silently drop a notification when the
  // UserPhotoReview row doesn't exist yet (e.g. legacy users whose default
  // photoStatus is 'pending' but who never triggered setPhotoPending).
  const [review] = await UserPhotoReview.findOrCreate({
    where: { userId },
    defaults: {
      userId,
      photoSubmittedAt: new Date(),
      heldNotifications: [],
    },
  });

  const held: any[] = Array.isArray(review.heldNotifications)
    ? review.heldNotifications
    : [];

  held.push({
    ...notification,
    createdAt: new Date().toISOString(),
  });

  await review.update({ heldNotifications: held });

  return true; // Queued — do NOT send now
};

/**
 * Release held notifications when user is approved
 */
export const releaseHeldNotifications = async (
  userId: number,
): Promise<void> => {
  const review = await UserPhotoReview.findOne({ where: { userId } });
  if (!review || !review.heldNotifications?.length) return;

  const user = await User.findByPk(userId);
  if (!user) return;

  for (const notif of review.heldNotifications) {
    if (notif.type === "like") {
      await sendPushNotification(userId, "New Like!", "Someone liked you! 💖", {
        screen: "Likes",
      });
      await Notification.create({
        user_id: userId,
        sender_id: notif.fromUserId,
        title: "New Like",
        message: "Someone liked you!",
        is_read: false,
        datesent: new Date(),
      });
    } else if (notif.type === "match") {
      await sendPushNotification(
        userId,
        "It's a Match!",
        "You have a new match! 🎉",
        { screen: "Chat" },
      );
      await Notification.create({
        user_id: userId,
        sender_id: notif.fromUserId,
        title: "New Match",
        message: "You have a new match!",
        is_read: false,
        datesent: new Date(),
      });
    } else if (notif.type === "message") {
      await sendPushNotification(
        userId,
        "New Message",
        "You received a new message",
        { screen: "Chat" },
      );
    }
  }

  // Clear held notifications
  await review.update({ heldNotifications: [] });
};

/**
 * Approve user photo
 */
export const approveUserPhoto = async (
  userId: number,
  adminId: number,
): Promise<void> => {
  // Update user
  await User.update({ photoStatus: "approved" }, { where: { id: userId } });

  // Upsert review record (create if doesn't exist)
  const [review, created] = await UserPhotoReview.findOrCreate({
    where: { userId },
    defaults: {
      userId,
      photoSubmittedAt: new Date(),
      photoReviewedAt: new Date(),
      photoReviewerId: adminId,
    },
  });

  // If record already existed (not created), update it
  if (!created) {
    await review.update({
      photoReviewedAt: new Date(),
      photoReviewerId: adminId,
    });
  }

  // Release held notifications (silent)
  await releaseHeldNotifications(userId);

  // Deliver outgoing like notifications that were suppressed while this user
  // was pending/rejected.  Now that they are approved they appear in the
  // recipient's likes list, so we can safely notify each recipient.
  try {
    const approvedUser = await User.findByPk(userId);
    const sentLikes = await Match.findAll({
      where: { user_id: userId, status: "like" },
    });

    for (const like of sentLikes) {
      const recipientId = Number(like.matched_user_id);

      // Skip mutual matches — those users already received a match notification
      const mutualMatch = await Match.findOne({
        where: {
          user_id: recipientId,
          matched_user_id: userId,
          status: "like",
        },
      });
      if (mutualMatch) continue;

      // Skip if a like notification from this user already exists in DB
      const alreadyNotified = await Notification.findOne({
        where: { user_id: recipientId, sender_id: userId, title: "New Like" },
      });
      if (alreadyNotified) continue;

      // Use queueOrSendNotification — recipient may themselves be pending/rejected
      const queued = await queueOrSendNotification(recipientId, {
        type: "like",
        fromUserId: userId,
      });

      if (!queued) {
        // Recipient is fully approved — send immediately
        await Notification.create({
          user_id: recipientId,
          sender_id: userId,
          title: "New Like",
          message: `${approvedUser?.f_name || "Someone"} liked you!`,
          is_read: false,
          datesent: new Date(),
        });

        const recipient = await User.findByPk(recipientId);
        
        // Send push notification to user (sendPushNotification will check for valid tokens in DB)
        // Do NOT check the 'push' field - if user has push tokens saved, we should send them
        // Notifications during account approval should reach the user regardless of login status
        await sendPushNotification(
          recipientId,
          "New Like",
          `${approvedUser?.f_name || "Someone"} liked you!`,
          { screen: "Likes" },
        );

        // Light up the likes tab badge for the recipient
        await User.update({ newlikes: true } as any, {
          where: { id: recipientId },
        });
      }
    }
  } catch (e) {
    console.error(
      "Error releasing outgoing like notifications on approval:",
      e,
    );
    // Non-critical — approval itself already succeeded, don't rethrow
  }
};

/**
 * Reject user photo
 */
export const rejectUserPhoto = async (
  userId: number,
  adminId: number,
  reason: string,
): Promise<void> => {
  try {
    // Update user
    await User.update({ photoStatus: "rejected" }, { where: { id: userId } });
  } catch (e: any) {
    console.error("Error updating user photoStatus:", e.message);
    throw new Error(`Failed to update user: ${e.message}`);
  }

  try {
    // Upsert review record (create if doesn't exist)
    const [review, created] = await UserPhotoReview.findOrCreate({
      where: { userId },
      defaults: {
        userId,
        photoSubmittedAt: new Date(),
        photoRejectReason: reason,
        photoReviewedAt: new Date(),
        photoReviewerId: adminId,
        rejectionNotifiedAt: new Date(),
      },
    });

    // If record already existed (not created), update it
    if (!created) {
      await review.update({
        photoRejectReason: reason,
        photoReviewedAt: new Date(),
        photoReviewerId: adminId,
        rejectionNotifiedAt: new Date(),
      });
    }
  } catch (e: any) {
    console.error("Error in UserPhotoReview findOrCreate/update:", e.message);
    throw new Error(`Failed to update review record: ${e.message}`);
  }
};

/**
 * Send rejection notifications to user
 */
export const sendRejectionNotifications = async (
  user: any,
  reason: string,
): Promise<void> => {
  // Push notification
  await sendPushNotification(
    user.id,
    "Image(s) Rejected",
    "Your image(s) does not meet our community guidelines. Tap to upload a new photo.",
    { screen: "Settings" },
  );

  // In-app notification (sender_id is nullable for system notifications)
  await Notification.create({
    user_id: user.id,
    sender_id: user.id, // Use user's own ID — avoids FK violation (no system user row exists)
    title: "Image(s) Rejected",
    message: `${reason}. Please upload a new photo.`,
    is_read: false,
    datesent: new Date(),
  });
};

/**
 * Get rejection reason for user (only if rejected)
 */
export const getPhotoRejectReason = async (
  userId: number,
): Promise<string | null> => {
  const user = await User.findByPk(userId, {
    attributes: ["photoStatus"],
  });

  if (user?.get("photoStatus") !== "rejected") {
    return null;
  }

  const review = await UserPhotoReview.findOne({
    where: { userId },
    attributes: ["photoRejectReason"],
  });

  return review?.photoRejectReason || null;
};
