import nodemailer from "nodemailer";
import dns from "dns";
dns.setDefaultResultOrder("ipv4first");

// Force Google DNS if environment DNS fails
if (process.env.NODE_ENV === 'production') {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
}

// Configure your email transporter here
// For production, use proper SMTP settings
const transporter = nodemailer.createTransport({
  host: "198.177.121.32",
  port: 465,
  secure: true,
  auth: {
    user: "non-reply@meintoyou.com",
    pass: process.env.EMAIL_PASSWORD,
  },
  tls: {
    rejectUnauthorized: true,
    servername: "mail.spacemail.com",
  },
});
export const sendOTPEmail = async (email: string, otp: string) => {
  try {
    const mailOptions = {
      from: "MeIntoYou <non-reply@meintoyou.com>",
      to: email,
      subject: "MeIntoYou - Verification Code",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>MeIntoYou Verification</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f8f6fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td align="center" style="padding: 40px 20px;">
                <table role="presentation" width="100%" max-width="480" cellpadding="0" cellspacing="0" border="0" style="max-width: 480px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
                  <!-- Header -->
                  <tr>
                    <td style="padding: 48px 32px 32px; text-align: center; border-bottom: 1px solid #f0e6f5;">
                      <div style="font-size: 28px; font-weight: 700; color: #800080; letter-spacing: -0.5px;">MeIntoYou</div>
                      <div style="font-size: 13px; color: #9b59b6; margin-top: 6px; font-weight: 500;">Verification Code</div>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px 32px;">
                      <p style="margin: 0 0 24px; font-size: 16px; color: #333333; line-height: 1.6;">
                        Here is your verification code to continue:
                      </p>
                      
                      <div style="text-align: center; margin: 32px 0;">
                        <div style="display: inline-block; background-color: #faf5fc; border: 2px solid #800080; border-radius: 12px; padding: 24px 40px;">
                          <span style="font-size: 36px; font-weight: 700; color: #800080; letter-spacing: 8px; font-family: 'Courier New', monospace;">${otp}</span>
                        </div>
                      </div>
                      
                      <p style="margin: 24px 0 0; font-size: 14px; color: #666666; line-height: 1.5; text-align: center;">
                        This code expires in <strong style="color: #800080;">10 minutes</strong>.
                      </p>
                      
                      <p style="margin: 20px 0 0; font-size: 13px; color: #888888; line-height: 1.5; text-align: center;">
                        If you didn't request this code, you can safely ignore this email.
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="padding: 24px 32px 32px; background-color: #faf8fb; border-top: 1px solid #f0e6f5; border-radius: 0 0 16px 16px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="text-align: center; padding-bottom: 16px;">
                            <a href="https://meintoyou.com/about" style="color: #800080; text-decoration: none; font-size: 13px; font-weight: 500; margin: 0 12px;">About</a>
                            <a href="https://meintoyou.com/contact" style="color: #800080; text-decoration: none; font-size: 13px; font-weight: 500; margin: 0 12px;">Contact</a>
                            <a href="https://meintoyou.com/privacy" style="color: #800080; text-decoration: none; font-size: 13px; font-weight: 500; margin: 0 12px;">Privacy</a>
                          </td>
                        </tr>
                        <tr>
                          <td style="text-align: center;">
                            <p style="margin: 0; font-size: 12px; color: #999999; line-height: 1.5;">
                              © ${new Date().getFullYear()} MeIntoYou. All rights reserved.<br>
                              <span style="color: #bbbbbb;">This is an automated message, please do not reply.</span>
                            </p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully:", info.messageId);
    return true;
  } catch (error: any) {
    console.error("Email sending error:", {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
    });
    return false;
  }
};

export const sendWarningEmail = async (email: string, strikes: number, reason: string) => {
  try {
    const mailOptions = {
      from: "MeIntoYou <non-reply@meintoyou.com>",
      to: email,
      subject: "MeIntoYou - Account Warning",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>MeIntoYou Account Warning</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f8f6fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td align="center" style="padding: 40px 20px;">
                <table role="presentation" width="100%" max-width="480" cellpadding="0" cellspacing="0" border="0" style="max-width: 480px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
                  <!-- Header -->
                  <tr>
                    <td style="padding: 48px 32px 32px; text-align: center; border-bottom: 1px solid #f0e6f5;">
                      <div style="font-size: 28px; font-weight: 700; color: #800080; letter-spacing: -0.5px;">MeIntoYou</div>
                      <div style="font-size: 13px; color: #c0392b; margin-top: 6px; font-weight: 600;">⚠ Account Warning</div>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px 32px;">
                      <p style="margin: 0 0 20px; font-size: 16px; color: #333333; line-height: 1.6;">
                        We have received a report about activity on your account that violates our community guidelines.
                      </p>
                      
                      <div style="background-color: #fdf6f3; border-left: 4px solid #e67e22; padding: 16px 20px; margin: 24px 0; border-radius: 0 8px 8px 0;">
                        <p style="margin: 0 0 8px; font-size: 13px; color: #888888; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Reason</p>
                        <p style="margin: 0; font-size: 15px; color: #333333; font-weight: 500;">${reason}</p>
                      </div>
                      
                      <div style="text-align: center; margin: 28px 0;">
                        <p style="margin: 0 0 12px; font-size: 14px; color: #666666;">Strike Count</p>
                        <div style="display: inline-flex; align-items: center; gap: 8px;">
                          ${[1, 2, 3].map(i => `<span style="display: inline-block; width: 32px; height: 32px; border-radius: 50%; text-align: center; line-height: 32px; font-weight: 700; font-size: 14px; ${i <= strikes ? 'background-color: #e74c3c; color: #ffffff;' : 'background-color: #eeeeee; color: #999999;'}">${i}</span>`).join('')}
                        </div>
                        <p style="margin: 12px 0 0; font-size: 13px; color: #999999;">${strikes} of 3 strikes</p>
                      </div>
                      
                      <div style="background-color: #faf8fb; border-radius: 10px; padding: 20px; margin-top: 24px;">
                        <p style="margin: 0; font-size: 14px; color: #666666; line-height: 1.6; text-align: center;">
                          <strong style="color: #800080;">Important:</strong> If you receive 3 strikes, your account will be permanently blocked. Please review our guidelines to ensure respectful interactions.
                        </p>
                      </div>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="padding: 24px 32px 32px; background-color: #faf8fb; border-top: 1px solid #f0e6f5; border-radius: 0 0 16px 16px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="text-align: center; padding-bottom: 16px;">
                            <a href="https://meintoyou.com/about" style="color: #800080; text-decoration: none; font-size: 13px; font-weight: 500; margin: 0 12px;">About</a>
                            <a href="https://meintoyou.com/contact" style="color: #800080; text-decoration: none; font-size: 13px; font-weight: 500; margin: 0 12px;">Contact</a>
                            <a href="https://meintoyou.com/privacy" style="color: #800080; text-decoration: none; font-size: 13px; font-weight: 500; margin: 0 12px;">Privacy</a>
                          </td>
                        </tr>
                        <tr>
                          <td style="text-align: center;">
                            <p style="margin: 0; font-size: 12px; color: #999999; line-height: 1.5;">
                              © ${new Date().getFullYear()} MeIntoYou. All rights reserved.<br>
                              <span style="color: #bbbbbb;">This is an automated message, please do not reply.</span>
                            </p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully:", info.messageId);
    return true;
  } catch (error: any) {
    console.error("Email sending error:", {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
    });
    return false;
  }
};

export const sendBlockedEmail = async (email: string, reason: string) => {
  try {
    const mailOptions = {
      from: "MeIntoYou <non-reply@meintoyou.com>",
      to: email,
      subject: "MeIntoYou - Account Blocked",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>MeIntoYou Account Blocked</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f8f6fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td align="center" style="padding: 40px 20px;">
                <table role="presentation" width="100%" max-width="480" cellpadding="0" cellspacing="0" border="0" style="max-width: 480px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
                  <!-- Header -->
                  <tr>
                    <td style="padding: 48px 32px 32px; text-align: center; border-bottom: 1px solid #f0e6f5;">
                      <div style="font-size: 28px; font-weight: 700; color: #800080; letter-spacing: -0.5px;">MeIntoYou</div>
                      <div style="font-size: 13px; color: #c0392b; margin-top: 6px; font-weight: 600;">Account Blocked</div>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px 32px;">
                      <div style="text-align: center; margin-bottom: 28px;">
                        <div style="display: inline-block; background: linear-gradient(135deg, #c0392b 0%, #e74c3c 100%); color: #ffffff; padding: 16px 40px; border-radius: 12px; font-size: 18px; font-weight: 700; letter-spacing: 2px; box-shadow: 0 4px 12px rgba(192, 57, 43, 0.3);">REJECTED</div>
                      </div>
                      
                      <p style="margin: 0 0 20px; font-size: 16px; color: #333333; line-height: 1.6; text-align: center;">
                        Your account has been permanently blocked due to repeated violations of our community guidelines.
                      </p>
                      
                      <div style="background-color: #fdf6f3; border-left: 4px solid #c0392b; padding: 16px 20px; margin: 24px 0; border-radius: 0 8px 8px 0;">
                        <p style="margin: 0 0 8px; font-size: 13px; color: #888888; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Final Violation</p>
                        <p style="margin: 0; font-size: 15px; color: #333333; font-weight: 500;">${reason}</p>
                      </div>
                      
                      <div style="background-color: #faf8fb; border-radius: 10px; padding: 24px; margin-top: 28px;">
                        <p style="margin: 0 0 16px; font-size: 14px; color: #666666; line-height: 1.6; text-align: center;">
                          If you believe this was a mistake, you can appeal this decision:
                        </p>
                        <p style="margin: 0; text-align: center;">
                          <a href="mailto:support.mentoyou@proton.me" style="display: inline-block; background-color: #800080; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-size: 14px; font-weight: 600;">Contact Support</a>
                        </p>
                        <p style="margin: 12px 0 0; font-size: 12px; color: #999999; text-align: center;">
                          support.mentoyou@proton.me
                        </p>
                      </div>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="padding: 24px 32px 32px; background-color: #faf8fb; border-top: 1px solid #f0e6f5; border-radius: 0 0 16px 16px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="text-align: center; padding-bottom: 16px;">
                            <a href="https://meintoyou.com/about" style="color: #800080; text-decoration: none; font-size: 13px; font-weight: 500; margin: 0 12px;">About</a>
                            <a href="https://meintoyou.com/contact" style="color: #800080; text-decoration: none; font-size: 13px; font-weight: 500; margin: 0 12px;">Contact</a>
                            <a href="https://meintoyou.com/privacy" style="color: #800080; text-decoration: none; font-size: 13px; font-weight: 500; margin: 0 12px;">Privacy</a>
                          </td>
                        </tr>
                        <tr>
                          <td style="text-align: center;">
                            <p style="margin: 0; font-size: 12px; color: #999999; line-height: 1.5;">
                              © ${new Date().getFullYear()} MeIntoYou. All rights reserved.<br>
                              <span style="color: #bbbbbb;">This is an automated message, please do not reply.</span>
                            </p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully:", info.messageId);
    return true;
  } catch (error: any) {
    console.error("Email sending error:", {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
    });
    return false;
  }
};

export const sendVerificationApprovedEmail = async (email: string) => {
  try {
    const mailOptions = {
      from: "MeIntoYou <non-reply@meintoyou.com>",
      to: email,
      subject: "MeIntoYou - Identity Verified",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>MeIntoYou Identity Verified</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f8f6fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td align="center" style="padding: 40px 20px;">
                <table role="presentation" width="100%" max-width="480" cellpadding="0" cellspacing="0" border="0" style="max-width: 480px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
                  <tr>
                    <td style="padding: 48px 32px 32px; text-align: center; border-bottom: 1px solid #f0e6f5;">
                      <div style="font-size: 28px; font-weight: 700; color: #800080; letter-spacing: -0.5px;">MeIntoYou</div>
                      <div style="font-size: 13px; color: #27ae60; margin-top: 6px; font-weight: 600;">Identity Verified</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 40px 32px;">
                      <div style="text-align: center; margin-bottom: 28px;">
                        <div style="display: inline-block; background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%); color: #ffffff; padding: 16px 40px; border-radius: 12px; font-size: 18px; font-weight: 700; letter-spacing: 2px; box-shadow: 0 4px 12px rgba(39, 174, 96, 0.3);">VERIFIED</div>
                      </div>
                      <p style="margin: 0 0 20px; font-size: 16px; color: #333333; line-height: 1.6; text-align: center;">
                        Congratulations! Your identity verification has been <strong style="color: #27ae60;">approved</strong>.
                      </p>
                      <p style="margin: 0; font-size: 14px; color: #666666; line-height: 1.6; text-align: center;">
                        You now have full access to all MeIntoYou features. Thank you for helping us keep our community safe.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 24px 32px 32px; background-color: #faf8fb; border-top: 1px solid #f0e6f5; border-radius: 0 0 16px 16px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="text-align: center; padding-bottom: 16px;">
                            <a href="https://meintoyou.com/about" style="color: #800080; text-decoration: none; font-size: 13px; font-weight: 500; margin: 0 12px;">About</a>
                            <a href="https://meintoyou.com/contact" style="color: #800080; text-decoration: none; font-size: 13px; font-weight: 500; margin: 0 12px;">Contact</a>
                            <a href="https://meintoyou.com/privacy" style="color: #800080; text-decoration: none; font-size: 13px; font-weight: 500; margin: 0 12px;">Privacy</a>
                          </td>
                        </tr>
                        <tr>
                          <td style="text-align: center;">
                            <p style="margin: 0; font-size: 12px; color: #999999; line-height: 1.5;">
                              © ${new Date().getFullYear()} MeIntoYou. All rights reserved.<br>
                              <span style="color: #bbbbbb;">This is an automated message, please do not reply.</span>
                            </p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Verification approved email sent:", info.messageId);
    return true;
  } catch (error: any) {
    console.error("Verification approved email error:", error.message);
    return false;
  }
};

export const sendVerificationRejectedEmail = async (email: string, reason: string) => {
  try {
    const mailOptions = {
      from: "MeIntoYou <non-reply@meintoyou.com>",
      to: email,
      subject: "MeIntoYou - Identity Verification Rejected",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>MeIntoYou Verification Rejected</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f8f6fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td align="center" style="padding: 40px 20px;">
                <table role="presentation" width="100%" max-width="480" cellpadding="0" cellspacing="0" border="0" style="max-width: 480px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
                  <tr>
                    <td style="padding: 48px 32px 32px; text-align: center; border-bottom: 1px solid #f0e6f5;">
                      <div style="font-size: 28px; font-weight: 700; color: #800080; letter-spacing: -0.5px;">MeIntoYou</div>
                      <div style="font-size: 13px; color: #c0392b; margin-top: 6px; font-weight: 600;">Verification Rejected</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 40px 32px;">
                      <p style="margin: 0 0 20px; font-size: 16px; color: #333333; line-height: 1.6; text-align: center;">
                        Unfortunately, your identity verification was <strong style="color: #c0392b;">not approved</strong>.
                      </p>
                      <div style="background-color: #fdf6f3; border-left: 4px solid #c0392b; padding: 16px 20px; margin: 24px 0; border-radius: 0 8px 8px 0;">
                        <p style="margin: 0 0 8px; font-size: 13px; color: #888888; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Reason</p>
                        <p style="margin: 0; font-size: 15px; color: #333333; font-weight: 500;">${reason || 'Documents did not meet verification requirements'}</p>
                      </div>
                      <p style="margin: 20px 0 0; font-size: 14px; color: #666666; line-height: 1.6; text-align: center;">
                        You can submit a new verification request with clearer documents at any time.
                      </p>
                      <div style="background-color: #faf8fb; border-radius: 10px; padding: 20px; margin-top: 24px;">
                        <p style="margin: 0; text-align: center;">
                          <a href="mailto:support.mentoyou@proton.me" style="display: inline-block; background-color: #800080; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-size: 14px; font-weight: 600;">Contact Support</a>
                        </p>
                        <p style="margin: 12px 0 0; font-size: 12px; color: #999999; text-align: center;">
                          support.mentoyou@proton.me
                        </p>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 24px 32px 32px; background-color: #faf8fb; border-top: 1px solid #f0e6f5; border-radius: 0 0 16px 16px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="text-align: center; padding-bottom: 16px;">
                            <a href="https://meintoyou.com/about" style="color: #800080; text-decoration: none; font-size: 13px; font-weight: 500; margin: 0 12px;">About</a>
                            <a href="https://meintoyou.com/contact" style="color: #800080; text-decoration: none; font-size: 13px; font-weight: 500; margin: 0 12px;">Contact</a>
                            <a href="https://meintoyou.com/privacy" style="color: #800080; text-decoration: none; font-size: 13px; font-weight: 500; margin: 0 12px;">Privacy</a>
                          </td>
                        </tr>
                        <tr>
                          <td style="text-align: center;">
                            <p style="margin: 0; font-size: 12px; color: #999999; line-height: 1.5;">
                              © ${new Date().getFullYear()} MeIntoYou. All rights reserved.<br>
                              <span style="color: #bbbbbb;">This is an automated message, please do not reply.</span>
                            </p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Verification rejected email sent:", info.messageId);
    return true;
  } catch (error: any) {
    console.error("Verification rejected email error:", error.message);
    return false;
  }
};

export const sendUnblockedEmail = async (email: string) => {
  try {
    const mailOptions = {
      from: "MeIntoYou <non-reply@meintoyou.com>",
      to: email,
      subject: "MeIntoYou - Account Unblocked",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>MeIntoYou Account Unblocked</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f8f6fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td align="center" style="padding: 40px 20px;">
                <table role="presentation" width="100%" max-width="480" cellpadding="0" cellspacing="0" border="0" style="max-width: 480px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
                  <tr>
                    <td style="padding: 48px 32px 32px; text-align: center; border-bottom: 1px solid #f0e6f5;">
                      <div style="font-size: 28px; font-weight: 700; color: #800080; letter-spacing: -0.5px;">MeIntoYou</div>
                      <div style="font-size: 13px; color: #27ae60; margin-top: 6px; font-weight: 600;">Account Unblocked</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 40px 32px;">
                      <div style="text-align: center; margin-bottom: 28px;">
                        <div style="display: inline-block; background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%); color: #ffffff; padding: 16px 40px; border-radius: 12px; font-size: 18px; font-weight: 700; letter-spacing: 2px; box-shadow: 0 4px 12px rgba(39, 174, 96, 0.3);">UNBLOCKED</div>
                      </div>
                      <p style="margin: 0 0 20px; font-size: 16px; color: #333333; line-height: 1.6; text-align: center;">
                        Good news! Your account has been <strong style="color: #27ae60;">unblocked</strong> and is now active again.
                      </p>
                      <p style="margin: 0; font-size: 14px; color: #666666; line-height: 1.6; text-align: center;">
                        You can now log in and use all MeIntoYou features. Please ensure you follow our community guidelines to avoid future blocks.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 24px 32px 32px; background-color: #faf8fb; border-top: 1px solid #f0e6f5; border-radius: 0 0 16px 16px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="text-align: center; padding-bottom: 16px;">
                            <a href="https://meintoyou.com/about" style="color: #800080; text-decoration: none; font-size: 13px; font-weight: 500; margin: 0 12px;">About</a>
                            <a href="https://meintoyou.com/contact" style="color: #800080; text-decoration: none; font-size: 13px; font-weight: 500; margin: 0 12px;">Contact</a>
                            <a href="https://meintoyou.com/privacy" style="color: #800080; text-decoration: none; font-size: 13px; font-weight: 500; margin: 0 12px;">Privacy</a>
                          </td>
                        </tr>
                        <tr>
                          <td style="text-align: center;">
                            <p style="margin: 0; font-size: 12px; color: #999999; line-height: 1.5;">
                              © ${new Date().getFullYear()} MeIntoYou. All rights reserved.<br>
                              <span style="color: #bbbbbb;">This is an automated message, please do not reply.</span>
                            </p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Unblocked email sent:", info.messageId);
    return true;
  } catch (error: any) {
    console.error("Unblocked email error:", error.message);
    return false;
  }
};

export const sendPasswordResetEmail = async (email: string, otp: string) => {
  try {
    const mailOptions = {
      from: "MeIntoYou <non-reply@meintoyou.com>",
      to: email,
      subject: "MeIntoYou - Password Reset",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>MeIntoYou Password Reset</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f8f6fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td align="center" style="padding: 40px 20px;">
                <table role="presentation" width="100%" max-width="480" cellpadding="0" cellspacing="0" border="0" style="max-width: 480px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
                  <!-- Header -->
                  <tr>
                    <td style="padding: 48px 32px 32px; text-align: center; border-bottom: 1px solid #f0e6f5;">
                      <div style="font-size: 28px; font-weight: 700; color: #800080; letter-spacing: -0.5px;">MeIntoYou</div>
                      <div style="font-size: 13px; color: #9b59b6; margin-top: 6px; font-weight: 500;">Password Reset</div>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px 32px;">
                      <p style="margin: 0 0 20px; font-size: 16px; color: #333333; line-height: 1.6;">
                        We received a request to reset your password. Use the code below to continue:
                      </p>
                      
                      <div style="text-align: center; margin: 32px 0;">
                        <div style="display: inline-block; background-color: #faf5fc; border: 2px solid #800080; border-radius: 12px; padding: 24px 40px;">
                          <span style="font-size: 36px; font-weight: 700; color: #800080; letter-spacing: 8px; font-family: 'Courier New', monospace;">${otp}</span>
                        </div>
                      </div>
                      
                      <p style="margin: 24px 0 0; font-size: 14px; color: #666666; line-height: 1.5; text-align: center;">
                        This code expires in <strong style="color: #800080;">10 minutes</strong>.
                      </p>
                      
                      <div style="background-color: #fdf6f3; border-radius: 10px; padding: 16px 20px; margin-top: 24px;">
                        <p style="margin: 0; font-size: 13px; color: #888888; line-height: 1.5; text-align: center;">
                          <strong style="color: #e67e22;">Security tip:</strong> If you didn't request this reset, someone may be trying to access your account. Please secure your account and consider changing your password.
                        </p>
                      </div>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="padding: 24px 32px 32px; background-color: #faf8fb; border-top: 1px solid #f0e6f5; border-radius: 0 0 16px 16px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="text-align: center; padding-bottom: 16px;">
                            <a href="https://meintoyou.com/about" style="color: #800080; text-decoration: none; font-size: 13px; font-weight: 500; margin: 0 12px;">About</a>
                            <a href="https://meintoyou.com/contact" style="color: #800080; text-decoration: none; font-size: 13px; font-weight: 500; margin: 0 12px;">Contact</a>
                            <a href="https://meintoyou.com/privacy" style="color: #800080; text-decoration: none; font-size: 13px; font-weight: 500; margin: 0 12px;">Privacy</a>
                          </td>
                        </tr>
                        <tr>
                          <td style="text-align: center;">
                            <p style="margin: 0; font-size: 12px; color: #999999; line-height: 1.5;">
                              © ${new Date().getFullYear()} MeIntoYou. All rights reserved.<br>
                              <span style="color: #bbbbbb;">This is an automated message, please do not reply.</span>
                            </p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully:", info.messageId);
    return true;
  } catch (error: any) {
    console.error("Email sending error:", {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
    });
    return false;
  }
};

