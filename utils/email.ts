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

export const sendPasswordResetEmail = async (email: string, resetLink: string) => {
  try {
    const mailOptions = {
      from: "meintoyouapp@gmail.com",
      to: email,
      subject: "MeIntoYou - Password Reset",
      html: `
        <h2>Password Reset Request</h2>
        <p>Click the link below to reset your password:</p>
        <a href="${resetLink}">${resetLink}</a>
        <p>This link will expire in 1 hour.</p>
      `,
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error("Email sending error:", error);
    return false;
  }
};

