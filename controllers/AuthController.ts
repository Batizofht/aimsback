import { Request, Response } from "express";
import User from "../models/User";
import bcrypt from "bcryptjs";
import { sendOTPEmail, sendPasswordResetEmail } from "../utils/email";
import { Op } from "sequelize";

// Generate OTP
const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const parseDateFromClient = (dateValue: any, clientTimestampValue: any): Date => {
  const rawClientTs = Array.isArray(clientTimestampValue) ? clientTimestampValue[0] : clientTimestampValue;
  if (rawClientTs !== undefined && rawClientTs !== null && String(rawClientTs).trim() !== "") {
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

// Register User
export const registerUser = async (req: Request, res: Response) => {
  try {
    const { username, phone } = req.body;

    if (!username || !phone) {
      res.status(400).json({ message: "Email and phone are required", status: 0 });
      return;
    }

    // Check if user already exists
    console.log(`email which is ${username} and  phone which is ${phone} are required`)
const existingUser = await User.findOne({
  where: { email: username },
});
 
   if (existingUser && existingUser.aproved === 'YES') {
      res.status(400).json({ message: "User already exists", status: 0 });
      return;
    }

    await User.destroy({
      where: {
        email: username,
      },
    });

    // Generate OTP
    const otp = generateOTP();
    const otpExpiry = new Date();
    otpExpiry.setMinutes(otpExpiry.getMinutes() + 10);

    // Create user with hashed password (temporary)
    const hashedPassword = await bcrypt.hash(otp, 10);
    const user = await User.create({
      email: username,
      phone: phone,
      password: hashedPassword,
      OTP: otp,
      OTPExpiry: otpExpiry,
      IsVerified: false,
      signedWithGoogle: 'NO',
    });

    res.status(200).json(user.id);
  } catch (error: any) {
    console.error("Register error:", error);
    res.status(500).json({ message: "Server error", status: 0 });
  }
};

// Send Verification Email
export const sendVerificationEmail = async (req: Request, res: Response) => {
  try {
    const { username, phone } = req.body;

    const user = await User.findOne({
      where: {
        [Op.or]: [{ email: username }, { phone: phone }],
      },
    });

    if (!user) {
      res.status(404).json(0);
      return;
    }

    // Generate new OTP
    const otp = generateOTP();
    const otpExpiry = new Date();
    otpExpiry.setMinutes(otpExpiry.getMinutes() + 10);

    await user.update({
      OTP: otp,
      OTPExpiry: otpExpiry,
    });

    // Send email
    const emailSent = await sendOTPEmail(user.email, otp);
    if (emailSent) {
      res.status(200).json(user.id);
    } else {
      res.status(500).json({ message: "Failed to send email", status: 0 });
    }
  } catch (error: any) {
    console.error("Send verification email error:", error);
    res.status(500).json({ message: "Server error", status: 0 });
  }
};

// Verify OTP
export const verifyOTP = async (req: Request, res: Response) => {
  try {
    const { vericode, email } = req.body;
    const otp = vericode;

    console.log('verifyOTP request:', { email, otp });

    const user = await User.findOne({
      where: { email: email },
    });

    if (!user) {
      console.log('verifyOTP user not found:', { email });
      res.status(404).json(0);
      return;
    }

    if (user.OTP !== otp) {
      console.log('verifyOTP mismatch:', { email });
      res.status(400).json(0);
      return;
    }

    if (user.OTPExpiry && new Date() > user.OTPExpiry) {
      console.log('verifyOTP expired:', { email });
      res.status(400).json(0);
      return;
    }

    await user.update({
      IsVerified: true,
      OTP: null as any,
      OTPExpiry: undefined,
    });

    res.status(200).json(user.id);
  } catch (error: any) {
    console.error("Verify OTP error:", error);
    res.status(500).json({ message: "Server error", status: 0 });
  }
};

// Resend OTP
export const resendOTP = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({
      where: { email: email },
    });

    if (!user) {
      res.status(404).json(0);
      return;
    }

    const otp = generateOTP();
    const otpExpiry = new Date();
    otpExpiry.setMinutes(otpExpiry.getMinutes() + 10);

    await user.update({
      OTP: otp,
      OTPExpiry: otpExpiry,
    });

    const emailSent = await sendOTPEmail(user.email, otp);
    if (emailSent) {
      res.status(200).json({ message: "OTP resent", status: 1 });
    } else {
      res.status(500).json({ message: "Failed to send email", status: 0 });
    }
  } catch (error: any) {
    console.error("Resend OTP error:", error);
    res.status(500).json({ message: "Server error", status: 0 });
  }
};

// Login User
export const loginUser = async (req: Request, res: Response) => {
  try {
    const { username, password, date, clientTimestamp } = req.body;
    const loginAt = parseDateFromClient(date, clientTimestamp);

    if (!username || !password) {
      res.status(400).json({ message: "Username and password are required", status: 0 });
      return;
    }

    const user = await User.findOne({
      where: {
        [Op.or]: [{ email: username }, { phone: username }],
      },
    });

    if (!user) {
      res.status(404).json(0);
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      res.status(401).json("Invalid password");
      return;
    }

    if ((user as any).isBlocked) {
      res.status(403).json({ message: "Account blocked", status: 0, isBlocked: true });
      return;
    }

    if (user.IsVerified === false) {
      res.status(403).json("Account not approved");
      return;
    }

    await user.update({ lastActiveAt: loginAt } as any);

    res.status(200).json(user.id);
  } catch (error: any) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error", status: 0 });
  }
};

// Google Auth (login or create user)
export const googleAuth = async (req: Request, res: Response) => {
  try {
    const { email, idToken, name } = req.body;

    if (!email || !idToken) {
      res.status(400).json({ message: "Email and token are required", status: 0 });
      return;
    }

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      if ((existingUser as any).isBlocked) {
        res.status(403).json({ message: "Account blocked", status: 0, isBlocked: true });
        return;
      }

      // Check if user was created manually (not with Google)
      if ((existingUser as any).signedWithGoogle === 'NO') {
        if (existingUser.aproved === 'NO') {
          const safeName = typeof name === 'string' ? name.trim() : '';
          const [firstName = '', ...restNames] = safeName.split(' ');
          const lastName = restNames.join(' ').trim();

          const randomPassword = Math.random().toString(36).slice(-12);
          const hashedPassword = await bcrypt.hash(randomPassword, 10);

          await existingUser.update({
            password: hashedPassword,
            f_name: firstName || (existingUser as any).f_name || undefined,
            l_name: lastName || (existingUser as any).l_name || undefined,
            IsVerified: false,
            aproved: (existingUser as any).aproved || 'NO',
            signedWithGoogle: 'YES',
            OTP: null as any,
            OTPExpiry: undefined,
          } as any);

          res.status(200).json({
            userId: existingUser.id,
            status: 1,
            isNewUser: true,
            requiresOnboarding: true,
          });
          return;
        }

        res.status(400).json({ 
          message: "There is already a user with this email that signed up manually. Please use your credentials to sign in.", 
          status: 0 
        });
        return;
      }

      // User was created with Google, allow sign in
      const requiresOnboarding = existingUser.aproved !== 'YES';
      res.status(200).json({
        userId: existingUser.id,
        status: 1,
        isNewUser: false,
        requiresOnboarding,
      });
      return;
    }

    // Create a new account for Google users with no phone requirement
    const randomPassword = Math.random().toString(36).slice(-12);
    const hashedPassword = await bcrypt.hash(randomPassword, 10);

    const safeName = typeof name === 'string' ? name.trim() : '';
    const [firstName = '', ...restNames] = safeName.split(' ');
    const lastName = restNames.join(' ').trim();

    const created = await User.create({
      email,
      phone: null,
      password: hashedPassword,
      f_name: firstName || undefined,
      l_name: lastName || undefined,
      IsVerified: true,
      aproved: 'NO',
      signedWithGoogle: 'YES',
      progress: 0,
    } as any);

    res.status(200).json({
      userId: created.id,
      status: 1,
      isNewUser: true,
      requiresOnboarding: true,
    });
  } catch (error: any) {
    console.error("Google auth error:", error);
    res.status(500).json({ message: "Server error", status: 0 });
  }
};

// Get User Data
export const getUserData = async (req: Request, res: Response) => {
  try {
    const { userid } = req.query;

    if (!userid) {
      res.status(400).json({ message: "User ID is required", status: 0 });
      return;
    }

    const userIdNumber = Number(userid);
    if (isNaN(userIdNumber) || userIdNumber <= 0) {
      res.status(400).json({ message: "Invalid user ID", status: 0 });
      return;
    }

    const user = await User.findByPk(userIdNumber);
    if (!user) {
      res.status(404).json(0);
      return;
    }

    const { password, OTP, OTPExpiry, ...userData } = user.toJSON();

    res.status(200).json(userData);
  } catch (error: any) {
    console.error("Get user data error:", error);
    res.status(500).json({ message: "Server error", status: 0 });
  }
};

// Forgot Password - Send Reset Email
export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { username } = req.body;
    const email = username;

    if (!email) {
      res.status(400).json(0);
      return;
    }

    console.log('forgotPassword request:', { email });

    const user = await User.findOne({
      where: { email: email },
    });

    if (!user) {
      res.status(404).json(0);
      return;
    }

    const resetToken = generateOTP();
    const resetExpiry = new Date();
    resetExpiry.setHours(resetExpiry.getHours() + 1);

    await user.update({
      OTP: resetToken,
      OTPExpiry: resetExpiry,
    });

    const emailSent = await sendPasswordResetEmail(user.email, resetToken);

    if (emailSent) {
      console.log('forgotPassword OTP sent:', { email });
      res.status(200).json(user.id);
    } else {
      console.log('forgotPassword failed to send OTP:', { email });
      res.status(500).json(0);
    }
  } catch (error: any) {
    console.error("Forgot password error:", error);
    res.status(500).json({ message: "Server error", status: 0 });
  }
};

// Update Username (Complete Registration)
export const updateUsername = async (req: Request, res: Response) => {
  try {
    const { username, fname, sname, password } = req.body;

    const userRecord = await User.findOne({
      where: { email: username },
    });

    if (!userRecord) {
      res.status(404).json("User not found");
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update user
    await userRecord.update({
      f_name: fname,
      l_name: sname,
      password: hashedPassword,
      IsVerified: true,
    });

    res.status(200).json(userRecord.id);
  } catch (error: any) {
    console.error("Update username error:", error);
    res.status(500).json("Server error");
  }
};

// Change Password or Reset Password
export const changePassword = async (req: Request, res: Response) => {
  try {
    const { changingpassword, restorepass, user, oldpass, pass, password, cpassword, email } = req.body;

    // Handle password reset (restorepass)
    if (restorepass) {
      const userEmail = email;
      const newPassword = password || pass;
      const confirmPassword = cpassword;

      if (newPassword !== confirmPassword) {
        res.status(400).json("Passwords do not match");
        return;
      }

      const userRecord = await User.findOne({
        where: { email: userEmail },
      });

      if (!userRecord) {
        res.status(404).json("User not found");
        return;
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await userRecord.update({ password: hashedPassword });

      res.status(200).json(userRecord.id);
      return;
    }

    // Handle change password (changingpassword)
    if (changingpassword) {
      const userRecord = await User.findOne({
        where: { email: user },
      });

      if (!userRecord) {
        res.status(404).json({ status: 0 });
        return;
      }

      const isPasswordValid = await bcrypt.compare(oldpass, userRecord.password);
      if (!isPasswordValid) {
        res.status(400).json({ status: 0 });
        return;
      }

      const hashedPassword = await bcrypt.hash(pass, 10);
      await userRecord.update({ password: hashedPassword });

      res.status(200).json({ status: 1 });
      return;
    }

    res.status(400).json({ status: 0 });
  } catch (error: any) {
    console.error("Change password error:", error);
    res.status(500).json({ status: 0 });
  }
};

// Delete Account
export const deleteAccount = async (req: Request, res: Response) => {
  try {
    const { deleteAccount } = req.query;
    const userId = Number(deleteAccount);

    if (!userId) {
      res.status(400).json({ message: "User ID is required", status: 0 });
      return;
    }

    const user = await User.findByPk(userId);
    if (!user) {
      res.status(404).json(0);
      return;
    }

    await user.destroy();
    res.status(200).json({ message: "Account deleted successfully", status: 1 });
  } catch (error: any) {
    console.error("Delete account error:", error);
    res.status(500).json({ message: "Server error", status: 0 });
  }
};

// Update Subscription Status
export const updateSubscriptionStatus = async (req: Request, res: Response) => {
  try {
    const { userId, subscription } = req.body;

    if (!userId || !subscription) {
      res.status(400).json({ message: "User ID and subscription type are required", status: 0 });
      return;
    }

    const user = await User.findByPk(Number(userId));
    if (!user) {
      res.status(404).json({ message: "User not found", status: 0 });
      return;
    }

    await user.update({ subs: subscription });
    
    res.status(200).json({ 
      message: "Subscription updated successfully", 
      status: 1,
      subscription 
    });
  } catch (error: any) {
    console.error("Update subscription error:", error);
    res.status(500).json({ message: "Server error", status: 0 });
  }
};

// Update Manual Location Status
export const updateManualLocationStatus = async (req: Request, res: Response) => {
  try {
    const { userId, isManualLocationUpdate } = req.body;

    if (!userId || typeof isManualLocationUpdate !== 'boolean') {
      res.status(400).json({ message: "User ID and manual location status are required", status: 0 });
      return;
    }

    const user = await User.findByPk(Number(userId));
    if (!user) {
      res.status(404).json({ message: "User not found", status: 0 });
      return;
    }

    await user.update({ isManualLocationUpdate });
    
    res.status(200).json({ 
      message: "Manual location status updated successfully", 
      status: 1,
      isManualLocationUpdate 
    });
  } catch (error: any) {
    console.error("Update manual location status error:", error);
    res.status(500).json({ message: "Server error", status: 0 });
  }
};

