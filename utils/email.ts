import nodemailer from "nodemailer";

// Configure your email transporter here
// For production, use proper SMTP settings
const transporter = nodemailer.createTransport({
  host:  "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: "meintoyouapp@gmail.com",
    pass: "dusi rtjs zotx kqsh"
    ,
  },
});

export const sendOTPEmail = async (email: string, otp: string) => {
  try {
    const mailOptions = {
      from: "meintoyouapp@gmail.com",
      to: email,
      subject: "MeIntoYou - Verification Code",
      html: `
        <h2>Your Verification Code</h2>
        <p>Your OTP code is: <strong>${otp}</strong></p>
        <p>This code will expire in 10 minutes.</p>
      `,
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error("Email sending error:", error);
    return false;
  }
};

export const sendWarningEmail = async (email: string, strikes: number, reason: string) => {
  try {
    const mailOptions = {
      from: "meintoyouapp@gmail.com",
      to: email,
      subject: "MeIntoYou - Account Warning",
      html: `
        <h2>Account Warning</h2>
        <p>We received a report regarding your account.</p>
        <p><strong>Reason:</strong> ${reason}</p>
        <p><strong>Strike:</strong> ${strikes} / 3</p>
        <p>If this behavior continues, your account may be blocked.</p>
      `,
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error("Email sending error:", error);
    return false;
  }
};

export const sendBlockedEmail = async (email: string, reason: string) => {
  try {
    const mailOptions = {
      from: "meintoyouapp@gmail.com",
      to: email,
      subject: "MeIntoYou - Account Blocked",
      html: `
        <h2>Account Blocked</h2>
        <p>Your account has been blocked due to repeated violations.</p>
        <p><strong>Reason:</strong> ${reason}</p>
        <p>If you believe this is a mistake, please contact our support team at <strong>support.mentoyou@proton.me</strong>.</p>
      `,
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error("Email sending error:", error);
    return false;
  }
};

export const sendPasswordResetEmail = async (email: string, otp: string) => {
  try {
    const mailOptions = {
      from: "meintoyouapp@gmail.com",
      to: email,
      subject: "MeIntoYou - Password Reset OTP",
      html: `
        <h2>Password Reset Request</h2>
        <p>Your OTP code is:</p>
        <div style="font-size: 32px; font-weight: bold; color: #800080; letter-spacing: 4px; margin: 20px 0;">
          ${otp}
        </div>
        <p>This code will expire in 10 minutes.</p>
      `,
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error("Email sending error:", error);
    return false;
  }
};

