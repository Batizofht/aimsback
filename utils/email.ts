import nodemailer from "nodemailer";
import dns from "dns";
dns.setDefaultResultOrder("ipv4first");

if (process.env.NODE_ENV === "production") {
  dns.setServers(["8.8.8.8", "8.8.4.4"]);
}

const transporter = nodemailer.createTransport({
  host: "webmail.aimscapital.org",
  port: 587,
  secure: false,
  auth: {
    user: "ourcontact@aimscapital.org",
    pass: "business12345@2025",
  },
  tls: { rejectUnauthorized: false },
});

function wrapHtml(bodyHtml: string) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>AIMS Capital</title></head>
<body style="margin:0;padding:0;background-color:#f0f5fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="100%" max-width="520" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background-color:#ffffff;border-radius:16px;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
          <tr>
            <td style="padding:40px 32px 24px;text-align:center;border-bottom:1px solid #e8edf2;">
              <div style="font-size:22px;font-weight:800;color:#0F2B4A;letter-spacing:-0.5px;">AIMS CAPITAL</div>
              <div style="font-size:11px;color:#5a7a9a;margin-top:4px;font-weight:500;letter-spacing:1px;">ATTORNEYS · ARBITRATORS · ADVISORS</div>
            </td>
          </tr>
          <tr><td style="padding:32px;">${bodyHtml}</td></tr>
          <tr>
            <td style="padding:24px 32px 32px;background-color:#f7fafc;border-top:1px solid #e8edf2;border-radius:0 0 16px 16px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#8899aa;line-height:1.6;">
                AIMS Capital — International Law & Investment Advisory<br>
                <span style="color:#aabbcc;">This is an automated message, please do not reply.</span>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export async function sendMembershipApprovedEmail(email: string, name: string) {
  try {
    await transporter.sendMail({
      from: "AIMS Capital <ourcontact@aimscapital.org>",
      to: email,
      subject: "AIMS Capital — Membership Approved",
      html: wrapHtml(`
        <p style="margin:0 0 20px;font-size:16px;color:#1a1a1a;line-height:1.6;">Dear ${name},</p>
        <p style="margin:0 0 20px;font-size:15px;color:#444;line-height:1.6;">Your AIMS Capital membership has been <strong style="color:#0F2B4A;">approved</strong>.</p>
        <div style="text-align:center;margin:32px 0;">
          <div style="display:inline-block;background:#0F2B4A;color:#fff;padding:14px 36px;border-radius:10px;font-size:15px;font-weight:700;letter-spacing:1px;">APPROVED</div>
        </div>
        <p style="margin:0 0 8px;font-size:15px;color:#444;line-height:1.6;">You can now sign in and access all member features:</p>
        <ul style="margin:0 0 24px;padding-left:20px;font-size:14px;color:#555;line-height:1.8;">
          <li>Book consultations and appointments</li>
          <li>Request legal and advisory services</li>
          <li>Message your dedicated advisors</li>
          <li>Track your service requests</li>
        </ul>
        <div style="text-align:center;margin:24px 0;">
          <a href="https://aimscapital.com/membership" style="display:inline-block;background:#0F2B4A;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:14px;font-weight:600;">Sign In to Your Account</a>
        </div>
      `),
    });
    return true;
  } catch (e: any) {
    console.error("Email error (approved):", e.message);
    return false;
  }
}

export async function sendMembershipRejectedEmail(email: string, name: string, reason: string) {
  try {
    await transporter.sendMail({
      from: "AIMS Capital <ourcontact@aimscapital.org>",
      to: email,
      subject: "AIMS Capital — Membership Update",
      html: wrapHtml(`
        <p style="margin:0 0 20px;font-size:16px;color:#1a1a1a;line-height:1.6;">Dear ${name},</p>
        <p style="margin:0 0 20px;font-size:15px;color:#444;line-height:1.6;">Your membership application could not be approved at this time.</p>
        <div style="background:#fdf2f0;border-left:4px solid #d32f2f;padding:16px 20px;margin:24px 0;border-radius:0 8px 8px 0;">
          <p style="margin:0 0 6px;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Reason</p>
          <p style="margin:0;font-size:15px;color:#1a1a1a;font-weight:500;">${reason}</p>
        </div>
        <p style="margin:20px 0 0;font-size:14px;color:#666;line-height:1.6;">
          You can update your information and re-submit your application at any time.
        </p>
        <div style="text-align:center;margin:24px 0;">
          <a href="https://aimscapital.com/membership" style="display:inline-block;background:#0F2B4A;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:14px;font-weight:600;">Update & Re-submit</a>
        </div>
      `),
    });
    return true;
  } catch (e: any) {
    console.error("Email error (rejected):", e.message);
    return false;
  }
}

export async function sendAppointmentScheduledEmail(email: string, name: string, title: string, date: string, time: string, platform: string) {
  try {
    await transporter.sendMail({
      from: "AIMS Capital <ourcontact@aimscapital.org>",
      to: email,
      subject: "AIMS Capital — Appointment Scheduled",
      html: wrapHtml(`
        <p style="margin:0 0 20px;font-size:16px;color:#1a1a1a;line-height:1.6;">Dear ${name},</p>
        <p style="margin:0 0 24px;font-size:15px;color:#444;line-height:1.6;">A new appointment has been <strong style="color:#0F2B4A;">scheduled</strong> for you with AIMS Capital.</p>
        <div style="background:#f7fafc;border:1px solid #e8edf2;border-radius:12px;padding:20px;margin:24px 0;">
          <table style="width:100%;font-size:14px;color:#444;">
            <tr><td style="padding:6px 0;color:#8899aa;width:80px;">Title</td><td style="padding:6px 0;font-weight:600;color:#1a1a1a;">${title}</td></tr>
            <tr><td style="padding:6px 0;color:#8899aa;">Date</td><td style="padding:6px 0;font-weight:600;color:#1a1a1a;">${date}</td></tr>
            <tr><td style="padding:6px 0;color:#8899aa;">Time</td><td style="padding:6px 0;font-weight:600;color:#1a1a1a;">${time}</td></tr>
            <tr><td style="padding:6px 0;color:#8899aa;">Platform</td><td style="padding:6px 0;font-weight:600;color:#1a1a1a;">${platform}</td></tr>
          </table>
        </div>
        <p style="margin:20px 0 0;font-size:14px;color:#666;line-height:1.6;">
          Please ensure you have the necessary access set up before the meeting. If you need to reschedule, sign in to your dashboard.
        </p>
      `),
    });
    return true;
  } catch (e: any) {
    console.error("Email error (appointment scheduled):", e.message);
    return false;
  }
}

export async function sendAppointmentConfirmedEmail(email: string, name: string, title: string, date: string, time: string, platform: string) {
  try {
    await transporter.sendMail({
      from: "AIMS Capital <ourcontact@aimscapital.org>",
      to: email,
      subject: "AIMS Capital — Appointment Confirmed",
      html: wrapHtml(`
        <p style="margin:0 0 20px;font-size:16px;color:#1a1a1a;line-height:1.6;">Dear ${name},</p>
        <p style="margin:0 0 24px;font-size:15px;color:#444;line-height:1.6;">Your appointment with AIMS Capital has been <strong style="color:#0F2B4A;">confirmed</strong>.</p>
        <div style="background:#f7fafc;border:1px solid #e8edf2;border-radius:12px;padding:20px;margin:24px 0;">
          <table style="width:100%;font-size:14px;color:#444;">
            <tr><td style="padding:6px 0;color:#8899aa;width:80px;">Title</td><td style="padding:6px 0;font-weight:600;color:#1a1a1a;">${title}</td></tr>
            <tr><td style="padding:6px 0;color:#8899aa;">Date</td><td style="padding:6px 0;font-weight:600;color:#1a1a1a;">${date}</td></tr>
            <tr><td style="padding:6px 0;color:#8899aa;">Time</td><td style="padding:6px 0;font-weight:600;color:#1a1a1a;">${time}</td></tr>
            <tr><td style="padding:6px 0;color:#8899aa;">Platform</td><td style="padding:6px 0;font-weight:600;color:#1a1a1a;">${platform}</td></tr>
          </table>
        </div>
        <p style="margin:20px 0 0;font-size:14px;color:#666;line-height:1.6;">
          Please ensure you have the necessary access set up before the meeting. If you need to reschedule, sign in to your dashboard.
        </p>
      `),
    });
    return true;
  } catch (e: any) {
    console.error("Email error (appointment confirmed):", e.message);
    return false;
  }
}

export async function sendContactReplyEmail(email: string, name: string, reply: string) {
  try {
    await transporter.sendMail({
      from: "AIMS Capital <ourcontact@aimscapital.org>",
      to: email,
      subject: "AIMS Capital — Response to Your Inquiry",
      html: wrapHtml(`
        <p style="margin:0 0 20px;font-size:16px;color:#1a1a1a;line-height:1.6;">Dear ${name},</p>
        <p style="margin:0 0 16px;font-size:15px;color:#444;line-height:1.6;">Thank you for reaching out to AIMS Capital. Here is our response:</p>
        <div style="background:#f7fafc;border:1px solid #e8edf2;border-radius:12px;padding:20px;margin:24px 0;">
          <p style="margin:0;font-size:15px;color:#1a1a1a;line-height:1.7;white-space:pre-wrap;">${reply}</p>
        </div>
        <p style="margin:20px 0 0;font-size:14px;color:#666;line-height:1.6;">
          If you have further questions, please don't hesitate to contact us again.
        </p>
      `),
    });
    return true;
  } catch (e: any) {
    console.error("Email error (contact reply):", e.message);
    return false;
  }
}

export async function sendContactMessageEmail(email: string, name: string, message: string) {
  try {
    await transporter.sendMail({
      from: "AIMS Capital <ourcontact@aimscapital.org>",
      to: email,
      subject: "AIMS Capital — Message Regarding Your Inquiry",
      html: wrapHtml(`
        <p style="margin:0 0 20px;font-size:16px;color:#1a1a1a;line-height:1.6;">Dear ${name},</p>
        <p style="margin:0 0 8px;font-size:15px;color:#444;line-height:1.6;">Message:</p>
        <div style="background:#f0f5fa;border:1px solid #d0ddee;border-radius:12px;padding:20px;margin:24px 0;">
          <p style="margin:0;font-size:15px;color:#1a1a1a;line-height:1.7;white-space:pre-wrap;">${message}</p>
        </div>
      `),
    });
    return true;
  } catch (e: any) {
    console.error("Email error (contact message):", e.message);
    return false;
  }
}

export async function sendServiceRequestUpdateEmail(email: string, name: string, service: string, status: string) {
  const label = status === "approved" ? "Approved" : "Rejected";
  const color = status === "approved" ? "#0F2B4A" : "#d32f2f";
  try {
    await transporter.sendMail({
      from: "AIMS Capital <ourcontact@aimscapital.org>",
      to: email,
      subject: `AIMS Capital — Service Request ${label}`,
      html: wrapHtml(`
        <p style="margin:0 0 20px;font-size:16px;color:#1a1a1a;line-height:1.6;">Dear ${name},</p>
        <p style="margin:0 0 20px;font-size:15px;color:#444;line-height:1.6;">Your service request for <strong style="color:#1a1a1a;">${service}</strong> has been <strong style="color:${color};">${label}</strong>.</p>
        <div style="text-align:center;margin:32px 0;">
          <div style="display:inline-block;background:${color};color:#fff;padding:14px 36px;border-radius:10px;font-size:15px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">${label}</div>
        </div>
      `),
    });
    return true;
  } catch (e: any) {
    console.error("Email error (service request):", e.message);
    return false;
  }
}

export async function sendConsultationReplyEmail(email: string, name: string, replyMessage: string, date: string, time: string, platform: string) {
  try {
    await transporter.sendMail({
      from: "AIMS Capital <ourcontact@aimscapital.org>",
      to: email,
      subject: "AIMS Capital — Your Consultation Booking",
      html: wrapHtml(`
        <p style="margin:0 0 20px;font-size:16px;color:#1a1a1a;line-height:1.6;">Dear ${name},</p>
        <p style="margin:0 0 20px;font-size:15px;color:#444;line-height:1.6;">Thank you for booking a consultation with AIMS Capital. Your booking has been confirmed.</p>
        <div style="background:#f7fafc;border:1px solid #e8edf2;border-radius:12px;padding:20px;margin:24px 0;">
          <table style="width:100%;font-size:14px;color:#444;">
            <tr><td style="padding:6px 0;color:#8899aa;width:80px;">Date</td><td style="padding:6px 0;font-weight:600;color:#1a1a1a;">${date}</td></tr>
            <tr><td style="padding:6px 0;color:#8899aa;">Time</td><td style="padding:6px 0;font-weight:600;color:#1a1a1a;">${time}</td></tr>
            <tr><td style="padding:6px 0;color:#8899aa;">Platform</td><td style="padding:6px 0;font-weight:600;color:#1a1a1a;">${platform}</td></tr>
          </table>
        </div>
        <p style="margin:0 0 12px;font-size:15px;color:#444;line-height:1.6;">Here are the details and next steps:</p>
        <div style="background:#f0f5fa;border:1px solid #d0ddee;border-radius:12px;padding:20px;margin:24px 0;">
          <p style="margin:0;font-size:15px;color:#1a1a1a;line-height:1.7;white-space:pre-wrap;">${replyMessage}</p>
        </div>
        <p style="margin:20px 0 0;font-size:14px;color:#666;line-height:1.6;">If you have any questions before the consultation, please reply to this email.</p>
      `),
    });
    return true;
  } catch (e: any) {
    console.error("Email error (consultation reply):", e.message);
    return false;
  }
}

export async function sendContactAutoReply(email: string, name: string) {
  try {
    await transporter.sendMail({
      from: "AIMS Capital <ourcontact@aimscapital.org>",
      to: email,
      subject: "AIMS Capital — We Received Your Message",
      html: wrapHtml(`
        <p style="margin:0 0 20px;font-size:16px;color:#1a1a1a;line-height:1.6;">Dear ${name},</p>
        <p style="margin:0 0 20px;font-size:15px;color:#444;line-height:1.6;">Thank you for reaching out to AIMS Capital.</p>
        <p style="margin:0 0 20px;font-size:15px;color:#444;line-height:1.6;">We have received your inquiry and our team will review it shortly. <strong style="color:#0F2B4A;">We will respond within 24 hours.</strong></p>
        <p style="margin:0 0 8px;font-size:15px;color:#444;line-height:1.6;">If your matter is urgent, please contact us directly:</p>
        <div style="background:#f7fafc;border:1px solid #e8edf2;border-radius:12px;padding:20px;margin:24px 0;">
          <p style="margin:0 0 6px;font-size:14px;color:#444;"><strong>Phone:</strong> +250 788 309 268</p>
          <p style="margin:0;font-size:14px;color:#444;"><strong>Office:</strong> KG 5 Ave, Plot 2, Kimihurura, Kigali</p>
        </div>
      `),
    });
    return true;
  } catch (e: any) {
    console.error("Email error (contact auto-reply):", e.message);
    return false;
  }
}

export async function sendConsultationAutoReply(email: string, name: string, date: string, time: string, platform: string) {
  try {
    await transporter.sendMail({
      from: "AIMS Capital <ourcontact@aimscapital.org>",
      to: email,
      subject: "AIMS Capital — Consultation Request Received",
      html: wrapHtml(`
        <p style="margin:0 0 20px;font-size:16px;color:#1a1a1a;line-height:1.6;">Dear ${name},</p>
        <p style="margin:0 0 20px;font-size:15px;color:#444;line-height:1.6;">Thank you for booking a consultation with AIMS Capital.</p>
        <p style="margin:0 0 20px;font-size:15px;color:#444;line-height:1.6;">We have received your request and our team will review it shortly. <strong style="color:#0F2B4A;">We will confirm your booking within 24 hours.</strong></p>
        <div style="background:#f7fafc;border:1px solid #e8edf2;border-radius:12px;padding:20px;margin:24px 0;">
          <table style="width:100%;font-size:14px;color:#444;">
            <tr><td style="padding:6px 0;color:#8899aa;width:80px;">Date</td><td style="padding:6px 0;font-weight:600;color:#1a1a1a;">${date}</td></tr>
            <tr><td style="padding:6px 0;color:#8899aa;">Time</td><td style="padding:6px 0;font-weight:600;color:#1a1a1a;">${time}</td></tr>
            <tr><td style="padding:6px 0;color:#8899aa;">Platform</td><td style="padding:6px 0;font-weight:600;color:#1a1a1a;">${platform}</td></tr>
          </table>
        </div>
      `),
    });
    return true;
  } catch (e: any) {
    console.error("Email error (consultation auto-reply):", e.message);
    return false;
  }
}

export async function sendContactTeamNotification(name: string, email: string, subject: string, body: string) {
  try {
    await transporter.sendMail({
      from: "AIMS Capital <ourcontact@aimscapital.org>",
      to: "ourcontact@aimscapital.org",
      subject: "New Contact Form Submission",
      html: wrapHtml(`
        <p style="margin:0 0 20px;font-size:16px;color:#1a1a1a;line-height:1.6;">A new contact form has been submitted:</p>
        <div style="background:#f7fafc;border:1px solid #e8edf2;border-radius:12px;padding:20px;margin:24px 0;">
          <table style="width:100%;font-size:14px;color:#444;">
            <tr><td style="padding:6px 0;color:#8899aa;width:100px;">Name</td><td style="padding:6px 0;font-weight:600;color:#1a1a1a;">${name}</td></tr>
            <tr><td style="padding:6px 0;color:#8899aa;">Email</td><td style="padding:6px 0;font-weight:600;color:#1a1a1a;">${email}</td></tr>
            <tr><td style="padding:6px 0;color:#8899aa;">Subject</td><td style="padding:6px 0;font-weight:600;color:#1a1a1a;">${subject}</td></tr>
          </table>
        </div>
        <div style="background:#f0f5fa;border:1px solid #d0ddee;border-radius:12px;padding:20px;margin:24px 0;">
          <p style="margin:0 0 6px;font-size:12px;color:#8899aa;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Message</p>
          <p style="margin:0;font-size:15px;color:#1a1a1a;line-height:1.7;white-space:pre-wrap;">${body}</p>
        </div>
      `),
    });
    return true;
  } catch (e: any) {
    console.error("Email error (contact team notification):", e.message);
    return false;
  }
}

export async function sendConsultationTeamNotification(name: string, email: string, date: string, time: string, platform: string) {
  try {
    await transporter.sendMail({
      from: "AIMS Capital <ourcontact@aimscapital.org>",
      to: "ourcontact@aimscapital.org",
      subject: "New Consultation Booking",
      html: wrapHtml(`
        <p style="margin:0 0 20px;font-size:16px;color:#1a1a1a;line-height:1.6;">A new consultation has been booked:</p>
        <div style="background:#f7fafc;border:1px solid #e8edf2;border-radius:12px;padding:20px;margin:24px 0;">
          <table style="width:100%;font-size:14px;color:#444;">
            <tr><td style="padding:6px 0;color:#8899aa;width:100px;">Name</td><td style="padding:6px 0;font-weight:600;color:#1a1a1a;">${name}</td></tr>
            <tr><td style="padding:6px 0;color:#8899aa;">Email</td><td style="padding:6px 0;font-weight:600;color:#1a1a1a;">${email}</td></tr>
            <tr><td style="padding:6px 0;color:#8899aa;">Date</td><td style="padding:6px 0;font-weight:600;color:#1a1a1a;">${date}</td></tr>
            <tr><td style="padding:6px 0;color:#8899aa;">Time</td><td style="padding:6px 0;font-weight:600;color:#1a1a1a;">${time}</td></tr>
            <tr><td style="padding:6px 0;color:#8899aa;">Platform</td><td style="padding:6px 0;font-weight:600;color:#1a1a1a;">${platform}</td></tr>
          </table>
        </div>
      `),
    });
    return true;
  } catch (e: any) {
    console.error("Email error (consultation team notification):", e.message);
    return false;
  }
}

export async function sendConsultationMessageEmail(email: string, name: string, message: string) {
  try {
    await transporter.sendMail({
      from: "AIMS Capital <ourcontact@aimscapital.org>",
      to: email,
      subject: "AIMS Capital — Message Regarding Your Consultation",
      html: wrapHtml(`
        <p style="margin:0 0 20px;font-size:16px;color:#1a1a1a;line-height:1.6;">Dear ${name},</p>
        <p style="margin:0 0 8px;font-size:15px;color:#444;line-height:1.6;">Message:</p>
        <div style="background:#f0f5fa;border:1px solid #d0ddee;border-radius:12px;padding:20px;margin:24px 0;">
          <p style="margin:0;font-size:15px;color:#1a1a1a;line-height:1.7;white-space:pre-wrap;">${message}</p>
        </div>
      `),
    });
    return true;
  } catch (e: any) {
    console.error("Email error (consultation message):", e.message);
    return false;
  }
}