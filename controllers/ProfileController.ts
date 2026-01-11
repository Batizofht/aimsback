import { Request, Response } from "express";
import User from "../models/User";
import { saveBase64Image, deleteImage } from "../utils/imageUtils";
import { Op } from "sequelize";
import { moderateImage } from "../utils/imageModeration";
import fs from "fs";
import { saveTempBase64 } from "../utils/saveTempBase64";
// Update Profile
export const updateProfile = async (req: Request, res: Response) => {
  try {
    const { user, fname, lname, bio, school, university, newlook, city, country } = req.body;

    const userRecord = await User.findByPk(user);
    if (!userRecord) {
      res.status(404).json({ message: "User not found", status: 0 });
      return;
    }

    const updateData: any = {};
    if (fname) updateData.f_name = fname;
    if (lname) updateData.l_name = lname;
    if (bio) updateData.bio = bio;
    if (school) updateData.education = school;
    if (university) updateData.schoolname = university;
    if (newlook) updateData.fors = newlook;
    if (city) updateData.city = city;
    if (country) updateData.country = country;

    await userRecord.update(updateData);

    // Calculate progress
    let progress = 0;
    if (userRecord.im1 && userRecord.im2 && userRecord.im3 && userRecord.im4) progress += 30;
    if (userRecord.profile) progress += 10;
    if (userRecord.email) progress += 5;
    if (userRecord.city && userRecord.country) progress += 10;
    if (userRecord.fors) progress += 5;
    if (userRecord.looking) progress += 10;
    if (userRecord.interest) progress += 5;
    if (userRecord.schoolname) progress += 5;
    if (userRecord.education) progress += 5;
    if (userRecord.bio) progress += 5;
    if (userRecord.Orientation) progress += 10;

    await userRecord.update({ progress });

    res.status(200).json({ message: "Profile updated successfully", status: 1 });
  } catch (error: any) {
    console.error("Update profile error:", error);
    res.status(500).json({ message: "Server error", status: 0 });
  }
};

// Update Profile Picture
export const updateProfilePicture = async (req: Request, res: Response) => {
  try {
    const { user, image, environment } = req.body;

    console.log("Update profile picture request received:", {
      user,
      imageLength: image?.length
    });

    if (!image || typeof image !== "string") {
      return res.status(400).json({ message: "Image is required", status: 0 });
    }

    const userRecord = await User.findByPk(user);
    if (!userRecord) {
      return res.status(404).json({ message: "User not found", status: 0 });
    }

    // 🔒 MODERATION RULES
    const rules = {
      allowShirtless: environment === "pool" || environment === "beach"
    };

    // 🔥 MODERATE BEFORE SAVING
    const tempPath = saveTempBase64(image);
    const allowed = await moderateImage(tempPath, rules);
    fs.unlinkSync(tempPath);

    if (!allowed) {
      return res.status(400).json({
        message: "Please upload a fully clothed, respectful photo.",
        status: 0
      });
    }

    // Delete old profile picture
    if (userRecord.profile) {
      deleteImage("Images", userRecord.profile);
    }

    // Save new profile picture
    const filename = saveBase64Image(image, "Images", "profile.jpg");
    await userRecord.update({ profile: filename });

    console.log(`Profile picture updated successfully: ${filename}`);

    res.status(200).json({
      message: "Profile picture updated",
      status: 1,
      filename
    });
  } catch (error: any) {
    console.error("Update profile picture error:", error);
    res.status(500).json({ message: "Server error", status: 0 });
  }
};


// Upload Multiple Images (Slider)
export const uploadMultipleImages = async (req: Request, res: Response) => {
  try {
    const { formstatus, images, user, positions, environment } = req.body;
    const userEmail = formstatus || user;

    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json("Images are required");
    }

    // Decide rules EXPLICITLY
    const rules = {
      allowShirtless: environment === "pool" || environment === "beach"
    };


    // 🔥 MODERATE EACH IMAGE BEFORE SAVING
    for (let i = 0; i < images.length; i++) {
      const tempPath = saveTempBase64(images[i]);

      const allowed = await moderateImage(tempPath, rules);
      fs.unlinkSync(tempPath);

      if (!allowed) {
        return res.status(400).json({
          message: "One or more images are not allowed. Please upload respectful photos only."
        });
      }
    }

    // 🔽 EXISTING LOGIC CONTINUES (UNCHANGED)
    const userRecord = await User.findOne({ where: { email: userEmail } });
    if (!userRecord) {
      return res.status(404).json("User not found");
    }

    const imageFields = ["im1", "im2", "im3", "im4"];
    const updateData: any = {};

    const positionsToUpdate = positions && Array.isArray(positions)
      ? positions.map((p: number) => p - 1)
      : images.map((_, i) => i);

    for (let i = 0; i < images.length && i < positionsToUpdate.length; i++) {
      const position = positionsToUpdate[i];
      if (position >= 0 && position < 4) {
        const oldField = imageFields[position];
        if (userRecord[oldField as keyof typeof userRecord]) {
          deleteImage("slider", userRecord[oldField as keyof typeof userRecord] as string);
        }

        const filename = saveBase64Image(images[i], "slider", `image${position + 1}.jpg`);
        updateData[imageFields[position]] = filename;
      }
    }

    if (Object.keys(updateData).length > 0) {
      await userRecord.update(updateData);
    }

    let progress = userRecord.progress || 0;
    if (updateData.im1 && updateData.im2 && updateData.im3 && updateData.im4) {
      progress = Math.max(progress, 30);
    }

    await userRecord.update({ progress, aproved: "YES" });

    res.status(200).json(userRecord.id);
  } catch (error) {
    console.error("Upload multiple images error:", error);
    res.status(500).json("Server error");
  }
};

// Get User Profile by ID
export const getUserProfile = async (req: Request, res: Response) => {
  try {
    const { post } = req.query;
    const userId = Number(post);

    if (!userId) {
      res.status(400).json({ message: "User ID is required", status: 0 });
      return;
    }

    const user = await User.findByPk(userId);
    if (!user) {
      res.status(404).json({ message: "User not found", status: 0 });
      return;
    }

    const userData: any = user.toJSON();
    delete (userData as any).password;
    delete (userData as any).OTP;
    delete (userData as any).OTPExpiry;

    res.status(200).json(userData);
  } catch (error: any) {
    console.error("Get user profile error:", error);
    res.status(500).json({ message: "Server error", status: 0 });
  }
};

// Update Location (GPS coordinates)
export const updateLocation = async (req: Request, res: Response) => {
  try {
    const { pho, lat, lon } = req.body;

    // console.log("Update location request:", { pho, lat, lon });

    if (!pho) {
      res.status(400).json({ message: "Email is required", status: 0 });
      return;
    }

    if (!lat || !lon || lat === 'null' || lon === 'null' || lat === 'undefined' || lon === 'undefined') {
      console.error("Invalid coordinates:", { lat, lon });
      res.status(400).json({ message: "Valid latitude and longitude are required", status: 0 });
      return;
    }

    const user = await User.findOne({
      where: { email: pho },
    });

    if (!user) {
      console.error("User not found:", pho);
      res.status(404).json({ message: "User not found", status: 0 });
      return;
    }

    const latitude = parseFloat(lat.toString());
    const longitude = parseFloat(lon.toString());

    if (isNaN(latitude) || isNaN(longitude)) {
      console.error("Invalid coordinate values:", { lat, lon, latitude, longitude });
      res.status(400).json({ message: "Invalid coordinate values", status: 0 });
      return;
    }

    await user.update({
      lats: latitude.toString(),
      longs: longitude.toString(),
    });

    // console.log(`Location updated successfully for user ${pho}:`, { latitude, longitude });
    res.status(200).json({ message: "Location updated", status: 1 });
  } catch (error: any) {
    console.error("Update location error:", error);
    res.status(500).json({ message: "Server error", status: 0 });
  }
};

// Update Country/City (from automatic detection)
export const updateCountryCity = async (req: Request, res: Response) => {
  try {
    const { userId, city, country } = req.body;

    if (!userId || !city || !country) {
      res.status(400).json({ message: "userId, city, and country are required", status: 0 });
      return;
    }

    const user = await User.findByPk(userId);
    if (!user) {
      res.status(404).json({ message: "User not found", status: 0 });
      return;
    }

    await user.update({
      city,
      country,
    });

    console.log(`Country/City updated for user ${userId}:`, { city, country });
    res.status(200).json({ message: "Country/City updated", status: 1 });
  } catch (error: any) {
    console.error("Update country/city error:", error);
    res.status(500).json({ message: "Server error", status: 0 });
  }
};

// Update Settings
export const updateSettings = async (req: Request, res: Response) => {
  try {
    const { firstages, firstemail, fromsecond, ownersecond, fromages, owner, global, globalownert, toppi, topowner, emailno, emailnowner, push, pushowner } = req.query;

    let user;
    let updateData: any = {};

    if (firstages && firstemail) {
      const emailStr = Array.isArray(firstemail) ? String(firstemail[0]) : String(firstemail);
      user = await User.findOne({ where: { email: emailStr } });
      if (user) updateData.ages = Math.floor(Number(firstages));
    } else if (fromsecond && ownersecond) {
      const emailStr = Array.isArray(ownersecond) ? String(ownersecond[0]) : String(ownersecond);
      user = await User.findOne({ where: { email: emailStr } });
      if (user) updateData.secondages = Math.floor(Number(fromsecond));
    } else if (fromages && owner) {
      const emailStr = Array.isArray(owner) ? String(owner[0]) : String(owner);
      user = await User.findOne({ where: { email: emailStr } });
      if (user) updateData.distance = Math.floor(Number(fromages));
    } else if (global && globalownert) {
      const emailStr = Array.isArray(globalownert) ? String(globalownert[0]) : String(globalownert);
      user = await User.findOne({ where: { email: emailStr } });
      if (user) updateData.globe = global;
    } else if (toppi && topowner) {
      const emailStr = Array.isArray(topowner) ? String(topowner[0]) : String(topowner);
      user = await User.findOne({ where: { email: emailStr } });
      if (user) updateData.toppicks = toppi;
    } else if (emailno && emailnowner) {
      const emailStr = Array.isArray(emailnowner) ? String(emailnowner[0]) : String(emailnowner);
      user = await User.findOne({ where: { email: emailStr } });
      if (user) updateData.emailnotification = emailno;
    } else if (push && pushowner) {
      const emailStr = Array.isArray(pushowner) ? String(pushowner[0]) : String(pushowner);
      user = await User.findOne({ where: { email: emailStr } });
      if (user) updateData.push = push;
    }

    if (!user) {
      res.status(404).json({ message: "User not found", status: 0 });
      return;
    }

    await user.update(updateData);
    res.status(200).json({ message: "Settings updated", status: 1 });
  } catch (error: any) {
    console.error("Update settings error:", error);
    res.status(500).json({ message: "Server error", status: 0 });
  }
};

// Update Gender/Orientation/Looking
export const updatePreferences = async (req: Request, res: Response) => {
  try {
    const { id, email, lookes, Orientation, looking, for: forValue, interest, date, month, year, gender } = req.body;
    const userEmail = (id || email) as string;

    if (!userEmail || typeof userEmail !== 'string') {
      res.status(400).json(0);
      return;
    }

    const userRecord = await User.findOne({
      where: { email: userEmail },
    });

    if (!userRecord) {
      res.status(404).json(0);
      return;
    }

    const updateData: any = {};
    
    // Handle different preference updates
    if (gender) {
      // Gender selection (my gender)
      updateData.gender = gender;
    } else if (Orientation) {
      // Sexual orientation
      updateData.Orientation = Orientation;
    } else if (looking && forValue) {
      // Want screen - looking for and relationship type
      // Option B: `looking` = wanttosee (WOMAN/MAN/OTHER)
      updateData.looking = looking;
      updateData.fors = forValue;
    } else if (date && month && year) {
      // Account setup - birth date
      const birthYear = parseInt(year);
      updateData.years = birthYear;
    } else if (interest) {
      updateData.interest = interest;
    } else if (lookes) {
      // Backward compatibility: older clients may send `lookes` for wanttosee
      updateData.looking = lookes;
    }

    
    await userRecord.update(updateData);
    
    // Reload the user record to ensure we have the latest data
    await userRecord.reload();

    // Update progress - safely access progress with null check
    if (!userRecord) {
      res.status(404).json(0);
      return;
    }
    
    let progress = userRecord.progress || 0;
    if (updateData.looking) progress = Math.max(progress, 10);
    if (updateData.Orientation) progress = Math.max(progress, 10);
    if (updateData.fors) progress = Math.max(progress, 5);
    if (updateData.years) progress = Math.max(progress, 5);
    if (updateData.interest) progress = Math.max(progress, 5);
    await userRecord.update({ progress });

    res.status(200).json(1);
  } catch (error: any) {
    console.error("Update preferences error:", error);
    res.status(500).json(0);
  }
};

