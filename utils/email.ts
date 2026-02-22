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

