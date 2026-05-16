import nodemailer from "nodemailer";
import dns from "dns";
dns.setDefaultResultOrder("ipv4first");

// Force Google DNS if environment DNS fails
if (process.env.NODE_ENV === 'production') {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
}

// Configure your email transporter here
const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  secure: false, // STARTTLS, not SSL
  auth: {
    user: "ab7574001@smtp-brevo.com",
    pass: process.env.EMAIL_PASSWORD,
  },
  tls: {
    rejectUnauthorized: true,
  },
});

export const sendCampaignEmail = async (email: string, subject: string, message: string) => {
  try {
    const mailOptions = {
      from: "Meintoyou Account Team <noreply@meintoyou.com>",
      to: email,
      subject: `MeIntoYou - ${subject}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>MeIntoYou Notification</title>
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
                      <div style="font-size: 13px; color: #9b59b6; margin-top: 6px; font-weight: 500;">${subject}</div>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px 32px;">
                      <p style="margin: 0; font-size: 16px; color: #333333; line-height: 1.6;">
                        ${message.replace(/\\n/g, '<br>')}
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
    console.log("Campaign email sent successfully:", info.messageId);
    return true;
  } catch (error: any) {
    console.error("Campaign email error:", error.message);
    return false;
  }
};
