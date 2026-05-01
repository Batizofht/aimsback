import { Op } from "sequelize";
import User from "../models/User";
import UserPhotoReview from "../models/UserPhotoReview";
import { sendRejectionNotifications } from "../utils/photoReview";

/**
 * Send reminder notifications to rejected users every 6 hours
 * Run this with a cron job: 0 0/6 * * * (every 6 hours)
 */
export const sendPhotoRejectionReminders = async (): Promise<void> => {
  try {
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);

    // Find rejected users who haven't been notified in the last 6 hours
    const rejectedReviews = await UserPhotoReview.findAll({
      where: {
        photoRejectReason: { [Op.ne]: null },
        [Op.or]: [
          { rejectionNotifiedAt: null },
          { rejectionNotifiedAt: { [Op.lt]: sixHoursAgo } },
        ],
      },
      include: [{
        model: User,
        as: 'user',
        where: { photoStatus: 'rejected' },
        required: true,
      }],
    });

    console.log(`[Photo Reminders] Found ${rejectedReviews.length} users to remind`);

    for (const review of rejectedReviews) {
      const user = (review as any).user;
      if (!user) continue;

      const reason = review.photoRejectReason || 'Photo does not meet requirements';

      try {
        // Send notifications
        await sendRejectionNotifications(user, reason);

        // Update notification timestamp
        await review.update({ rejectionNotifiedAt: new Date() });

        console.log(`[Photo Reminders] Sent reminder to user ${user.id}`);
      } catch (err) {
        console.error(`[Photo Reminders] Failed to send reminder to user ${user.id}:`, err);
      }
    }

    console.log('[Photo Reminders] Completed');
  } catch (error) {
    console.error('[Photo Reminders] Cron job error:', error);
  }
};

/**
 * Setup function to run reminders
 * Call this from your cron scheduler (node-cron, node-schedule, etc.)
 */
export const setupPhotoReviewReminders = () => {
  // Run immediately on startup (optional)
  // sendPhotoRejectionReminders();

  // Then schedule every 6 hours
  const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

  setInterval(() => {
    sendPhotoRejectionReminders();
  }, SIX_HOURS_MS);

  console.log('[Photo Reminders] Scheduled every 6 hours');
};
