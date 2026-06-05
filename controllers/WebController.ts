import { Request, Response } from "express";
import User from "../models/User";

/**
 * WebController — handles web dashboard-specific profile updates
 * that the legacy PHP endpoints don't cover.
 */

// Update profile fields that the legacy profile.php doesn't handle
export const updateProfileFields = async (req: Request, res: Response) => {
  try {
    const { userId, fors, Orientation, looking } = req.body;

    if (!userId) {
      res.status(400).json({ message: "userId is required", status: 0 });
      return;
    }

    const user = await User.findByPk(userId);
    if (!user) {
      res.status(404).json({ message: "User not found", status: 0 });
      return;
    }

    const updates: Record<string, string> = {};
    if (fors !== undefined) updates.fors = fors;
    if (Orientation !== undefined) updates.Orientation = Orientation;
    if (looking !== undefined) updates.looking = looking;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ message: "No fields to update", status: 0 });
      return;
    }

    await User.update(updates, { where: { id: userId } });

    res.status(200).json({ status: 1, message: "Profile updated", updated: updates });
  } catch (error: any) {
    console.error("[WebController] updateProfileFields error:", error);
    res.status(500).json({ message: "Server error", status: 0, error: error.message });
  }
};

// Remove a specific image slot
export const removeImageSlot = async (req: Request, res: Response) => {
  try {
    const { userId, slot } = req.body;

    if (!userId || !slot) {
      res.status(400).json({ message: "userId and slot are required", status: 0 });
      return;
    }

    const slotNum = Number(slot);
    if (slotNum < 1 || slotNum > 4) {
      res.status(400).json({ message: "slot must be 1-4", status: 0 });
      return;
    }

    const user = await User.findByPk(userId);
    if (!user) {
      res.status(404).json({ message: "User not found", status: 0 });
      return;
    }

    const slotField = `im${slotNum}` as "im1" | "im2" | "im3" | "im4";
    await User.update({ [slotField]: null }, { where: { id: userId } });

    res.status(200).json({ status: 1, message: `Image slot ${slotNum} cleared` });
  } catch (error: any) {
    console.error("[WebController] removeImageSlot error:", error);
    res.status(500).json({ message: "Server error", status: 0, error: error.message });
  }
};
