import { config } from "../config/index.ts";

/**
 * Branded transactional email templates. All templates share one base layout
 * that mirrors the app's design system: Plus Jakarta Sans, primary blue
 * #004DE7, and the gray text scale used across the frontend. Layout is
 * table-based with inline styles so it renders consistently in Gmail,
 * Outlook and Apple Mail.
 */

const BRAND = {
  primary: "#004DE7",
  primaryDark: "#0037A4",
  primaryTint: "#E6EDFD",
  heading: "#111111",
  body: "#414141",
  muted: "#888888",
  faint: "#ADADAD",
  background: "#F4F6FB",
  card: "#ffffff",
  border: "#E6EDFD",
  hairline: "#EDEDED",
  success: "#13A368",
  successTint: "#E8FCF4",
  danger: "#D42C19",
  dangerTint: "#FDEAE8",
  warning: "#B45309",
  warningTint: "#FEF3E2",
} as const;

const FONT_STACK =
  "'Plus Jakarta Sans', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function logoSrc(): string {
  return config.mail.logoUrl;
}

export type EmailAccent = "brand" | "success" | "danger" | "warning";

const ACCENT_COLOR: Record<EmailAccent, string> = {
  brand: BRAND.primary,
  success: BRAND.success,
  danger: BRAND.danger,
  warning: BRAND.warning,
};

export function infoRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:10px 0;font-family:${FONT_STACK};font-size:13px;line-height:1.5;color:${BRAND.muted};white-space:nowrap;vertical-align:top;width:120px;">${escapeHtml(label)}</td>
    <td style="padding:10px 0;font-family:${FONT_STACK};font-size:14px;line-height:1.5;font-weight:600;color:${BRAND.heading};vertical-align:top;">${escapeHtml(value)}</td>
  </tr>`;
}

export function metaTable(rows: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 4px 0;border-top:1px solid ${BRAND.hairline};border-bottom:1px solid ${BRAND.hairline};">
    ${rows}
  </table>`;
}

export function statusBadge(label: string, accent: EmailAccent = "brand"): string {
  const tint: Record<EmailAccent, string> = {
    brand: BRAND.primaryTint,
    success: BRAND.successTint,
    danger: BRAND.dangerTint,
    warning: BRAND.warningTint,
  };
  return `<span style="display:inline-block;padding:5px 12px;border-radius:999px;background-color:${tint[accent]};font-family:${FONT_STACK};font-size:12px;font-weight:700;letter-spacing:0.02em;text-transform:uppercase;color:${ACCENT_COLOR[accent]};">${escapeHtml(label)}</span>`;
}

export function calloutBox(html: string, accent: EmailAccent = "brand"): string {
  const tint: Record<EmailAccent, string> = {
    brand: BRAND.primaryTint,
    success: BRAND.successTint,
    danger: BRAND.dangerTint,
    warning: BRAND.warningTint,
  };
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
    <tr>
      <td style="background-color:${tint[accent]};border-left:3px solid ${ACCENT_COLOR[accent]};border-radius:8px;padding:14px 16px;font-family:${FONT_STACK};font-size:14px;line-height:1.6;color:${BRAND.body};">${html}</td>
    </tr>
  </table>`;
}

export interface EmailContent {
  preview: string;
  heading: string;
  bodyHtml: string;
  cta: { label: string; url: string };
  footnote: string;
  accent?: EmailAccent;
  eyebrow?: string;
}

export function renderEmail(content: EmailContent): string {
  const year = new Date().getFullYear();
  const ctaUrl = escapeHtml(content.cta.url);
  const accent = content.accent ?? "brand";
  const accentColor = ACCENT_COLOR[accent];
  const eyebrowHtml = content.eyebrow
    ? `<p style="margin:0 0 10px 0;font-family:${FONT_STACK};font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${accentColor};">${escapeHtml(content.eyebrow)}</p>`
    : "";
  const linkFallback = content.cta.url.startsWith("http")
    ? `<p style="margin:0 0 6px 0;font-family:${FONT_STACK};font-size:12px;line-height:1.6;color:${BRAND.faint};">
                Button not working? Copy this link into your browser:
              </p>
              <p style="margin:0 0 4px 0;font-family:${FONT_STACK};font-size:12px;line-height:1.6;word-break:break-all;">
                <a href="${ctaUrl}" target="_blank" style="color:${BRAND.primary};text-decoration:underline;">${ctaUrl}</a>
              </p>`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light only" />
  <title>${escapeHtml(content.heading)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
</head>
<body style="margin:0;padding:0;background-color:${BRAND.background};-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(content.preview)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.background};">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
          <tr>
            <td style="background-color:${BRAND.card};border:1px solid ${BRAND.border};border-radius:18px;overflow:hidden;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="height:4px;background-color:${accentColor};line-height:4px;font-size:4px;">&nbsp;</td>
                </tr>
                <tr>
                  <td style="background-color:#FAFBFE;border-bottom:1px solid ${BRAND.hairline};padding:24px 40px;">
                    <a href="${escapeHtml(config.mail.appUrl)}" target="_blank" style="text-decoration:none;">
                      <img src="${escapeHtml(logoSrc())}" width="116" height="42" alt="BuildPanda"
                        style="display:block;border:0;outline:none;height:42px;width:116px;" />
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style="padding:36px 40px 40px 40px;">
                    ${eyebrowHtml}
                    <h1 style="margin:0 0 18px 0;font-family:${FONT_STACK};font-size:23px;line-height:1.3;font-weight:800;letter-spacing:-0.01em;color:${BRAND.heading};">
                      ${escapeHtml(content.heading)}
                    </h1>
                    <div style="font-family:${FONT_STACK};font-size:15px;line-height:1.7;color:${BRAND.body};">
                      ${content.bodyHtml}
                    </div>
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 4px 0;">
                      <tr>
                        <td align="center" style="background-color:${accentColor};border-radius:10px;">
                          <a href="${ctaUrl}" target="_blank"
                            style="display:inline-block;padding:14px 34px;font-family:${FONT_STACK};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">
                            ${escapeHtml(content.cta.label)}
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 40px 32px 40px;">
                    ${linkFallback}
                    <hr style="border:none;border-top:1px solid ${BRAND.hairline};margin:18px 0 16px 0;" />
                    <p style="margin:0;font-family:${FONT_STACK};font-size:13px;line-height:1.6;color:${BRAND.faint};">
                      ${escapeHtml(content.footnote)}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:28px 24px 0 24px;">
              <p style="margin:0 0 6px 0;font-family:${FONT_STACK};font-size:13px;line-height:1.6;font-weight:700;color:${BRAND.muted};">
                BuildPanda
              </p>
              <p style="margin:0 0 12px 0;font-family:${FONT_STACK};font-size:12px;line-height:1.6;color:${BRAND.faint};">
                Manage every build with confidence.
              </p>
              <p style="margin:0;font-family:${FONT_STACK};font-size:12px;line-height:1.6;color:${BRAND.faint};">
                &copy; ${year} BuildPanda. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function verificationEmail(options: {
  name: string;
  url: string;
}): { subject: string; html: string } {
  const name = escapeHtml(options.name);
  return {
    subject: "Verify your email address",
    html: renderEmail({
      preview: "Confirm your email to start using BuildPanda.",
      heading: "Verify your email",
      bodyHtml: `<p style="margin:0;">Hi ${name},</p>
                 <p style="margin:12px 0 0 0;">Thanks for signing up for BuildPanda! Please confirm your email address so we know it's really you.</p>`,
      cta: { label: "Verify Email", url: options.url },
      footnote:
        "This link expires in 1 hour. If you didn't create a BuildPanda account, you can safely ignore this email.",
    }),
  };
}

export function passwordResetEmail(options: {
  name: string;
  url: string;
}): { subject: string; html: string } {
  const name = escapeHtml(options.name);
  return {
    subject: "Reset your password",
    html: renderEmail({
      preview: "Choose a new password for your BuildPanda account.",
      heading: "Reset your password",
      bodyHtml: `<p style="margin:0;">Hi ${name},</p>
                 <p style="margin:12px 0 0 0;">We received a request to reset the password for your BuildPanda account. Click the button below to choose a new one.</p>`,
      cta: { label: "Reset Password", url: options.url },
      footnote:
        "This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email — your password won't change.",
    }),
  };
}

export function organizationInviteEmail(options: {
  inviterName: string;
  organizationName: string;
  url: string;
}): { subject: string; html: string } {
  const inviter = escapeHtml(options.inviterName);
  const org = escapeHtml(options.organizationName);
  return {
    subject: `You're invited to join ${options.organizationName} on BuildPanda`,
    html: renderEmail({
      preview: `${options.inviterName} invited you to collaborate on ${options.organizationName}.`,
      heading: `Join ${options.organizationName}`,
      bodyHtml: `<p style="margin:0;"><strong style="color:${BRAND.heading};">${inviter}</strong> invited you to collaborate with <strong style="color:${BRAND.heading};">${org}</strong> on BuildPanda — manage projects, schedules, budgets and documents in one place.</p>`,
      cta: { label: "Accept Invitation", url: options.url },
      footnote:
        "If you weren't expecting this invitation, you can safely ignore this email.",
    }),
  };
}

export interface ConsultationLead {
  name: string;
  email: string;
  phone: string;
  location: string;
  projectType: string;
  message?: string;
  source?: string;
}

/**
 * Internal notification sent to the BuildPanda team when someone submits the
 * "Book a consultation" form on the marketing site.
 */
export function consultationLeadEmail(lead: ConsultationLead): {
  subject: string;
  html: string;
} {
  const rows: Array<[string, string]> = [
    ["Name", lead.name],
    ["Email", lead.email],
    ["Phone / WhatsApp", lead.phone],
    ["Build location", lead.location],
    ["Project type", lead.projectType],
  ];
  if (lead.message) rows.push(["Message", lead.message]);
  if (lead.source) rows.push(["Source", lead.source]);

  const detailRows = rows
    .map(
      ([label, value]) => `<tr>
        <td style="padding:8px 16px 8px 0;font-family:${FONT_STACK};font-size:13px;font-weight:600;color:${BRAND.muted};white-space:nowrap;vertical-align:top;">${escapeHtml(label)}</td>
        <td style="padding:8px 0;font-family:${FONT_STACK};font-size:14px;color:${BRAND.heading};vertical-align:top;">${escapeHtml(value)}</td>
      </tr>`,
    )
    .join("");

  return {
    subject: `New consultation request from ${lead.name}`,
    html: renderEmail({
      preview: `${lead.name} (${lead.location}) — ${lead.projectType}`,
      heading: "New consultation request",
      bodyHtml: `<p style="margin:0 0 16px 0;">Someone just booked a consultation on buildpanda.io. Respond within one business day:</p>
                 <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-top:1px solid ${BRAND.border};border-bottom:1px solid ${BRAND.border};">${detailRows}</table>`,
      cta: {
        label: `Reply to ${lead.name}`,
        url: `mailto:${lead.email}?subject=${encodeURIComponent("Your BuildPanda consultation")}`,
      },
      footnote:
        "You're receiving this because you're listed as the consultation contact for buildpanda.io.",
    }),
  };
}

export function proposalSentEmail(options: {
  clientName: string;
  companyName: string;
  proposalTitle: string;
  proposalNumber: string;
  shareUrl: string;
  validUntil?: string;
}): { subject: string; html: string } {
  const client = escapeHtml(options.clientName);
  const company = escapeHtml(options.companyName);
  const title = escapeHtml(options.proposalTitle);
  const num = escapeHtml(options.proposalNumber);
  const expiry = options.validUntil
    ? `<p style="margin:12px 0 0 0;">This proposal is valid until <strong style="color:${BRAND.heading};">${escapeHtml(options.validUntil)}</strong>.</p>`
    : "";
  return {
    subject: `Your proposal from ${options.companyName} is ready`,
    html: renderEmail({
      preview: `${options.companyName} has sent you a proposal for ${options.proposalTitle}.`,
      heading: "Your proposal is ready",
      bodyHtml: `<p style="margin:0;">Hi ${client},</p>
                 <p style="margin:12px 0 0 0;"><strong style="color:${BRAND.heading};">${company}</strong> has prepared proposal <strong style="color:${BRAND.heading};">${num}</strong> — <em>${title}</em> — for your review.</p>
                 <p style="margin:12px 0 0 0;">You can view the full estimate, accept, or request changes by clicking the button below.</p>
                 ${expiry}`,
      cta: { label: "View Proposal", url: options.shareUrl },
      footnote: "You can accept, decline, or request changes at any time before the proposal expires.",
    }),
  };
}

export function proposalResponseEmail(options: {
  action: "accept" | "decline" | "change_requested";
  clientName: string;
  proposalTitle: string;
  proposalNumber: string;
  shareUrl: string;
}): { subject: string; html: string } {
  const client = escapeHtml(options.clientName);
  const title = escapeHtml(options.proposalTitle);
  const num = escapeHtml(options.proposalNumber);

  const actionLabel =
    options.action === "accept"
      ? "accepted"
      : options.action === "decline"
        ? "declined"
        : "requested changes on";

  const subjectVerb =
    options.action === "accept"
      ? "Accepted"
      : options.action === "decline"
        ? "Declined"
        : "Changes requested on";

  const ctaLabel =
    options.action === "accept"
      ? "View Accepted Proposal"
      : options.action === "decline"
        ? "View Proposal"
        : "View Proposal & Revise";

  return {
    subject: `${subjectVerb}: Proposal ${options.proposalNumber} — ${options.proposalTitle}`,
    html: renderEmail({
      preview: `${options.clientName} has ${actionLabel} proposal ${options.proposalNumber}.`,
      heading: `Proposal ${actionLabel}`,
      bodyHtml: `<p style="margin:0;"><strong style="color:${BRAND.heading};">${client}</strong> has ${actionLabel} your proposal <strong style="color:${BRAND.heading};">${num}</strong> — <em>${title}</em>.</p>
                 ${options.action === "change_requested" ? `<p style="margin:12px 0 0 0;">Review the feedback and update the estimate as needed.</p>` : ""}
                 ${options.action === "accept" ? `<p style="margin:12px 0 0 0;">You can now convert this proposal into a construction project.</p>` : ""}`,
      cta: { label: ctaLabel, url: options.shareUrl },
      footnote: "Log in to BuildPanda to take the next step.",
    }),
  };
}

export function proposalExpiryNudgeEmail(options: {
  companyEmail: string;
  proposalTitle: string;
  proposalNumber: string;
  clientName: string;
  validUntil: string;
  workspaceUrl: string;
}): { subject: string; html: string } {
  const title = escapeHtml(options.proposalTitle);
  const num = escapeHtml(options.proposalNumber);
  const client = escapeHtml(options.clientName);
  const expiry = escapeHtml(options.validUntil);
  return {
    subject: `Proposal ${options.proposalNumber} expires soon`,
    html: renderEmail({
      preview: `Your proposal for ${options.clientName} expires on ${options.validUntil}.`,
      heading: "Proposal expiring soon",
      bodyHtml: `<p style="margin:0;">Proposal <strong style="color:${BRAND.heading};">${num}</strong> — <em>${title}</em> — for client <strong style="color:${BRAND.heading};">${client}</strong> will expire on <strong style="color:${BRAND.heading};">${expiry}</strong>.</p>
                 <p style="margin:12px 0 0 0;">Consider following up with the client to keep the deal moving.</p>`,
      cta: { label: "View Proposal", url: options.workspaceUrl },
      footnote: "You're receiving this because you manage proposals on BuildPanda.",
    }),
  };
}

export function proposalExpiredEmail(options: {
  proposalTitle: string;
  proposalNumber: string;
  clientName: string;
  workspaceUrl: string;
}): { subject: string; html: string } {
  const title = escapeHtml(options.proposalTitle);
  const num = escapeHtml(options.proposalNumber);
  const client = escapeHtml(options.clientName);
  return {
    subject: `Proposal ${options.proposalNumber} has expired`,
    html: renderEmail({
      preview: `Your proposal for ${options.clientName} has expired.`,
      heading: "Proposal expired",
      bodyHtml: `<p style="margin:0;">Proposal <strong style="color:${BRAND.heading};">${num}</strong> — <em>${title}</em> — for client <strong style="color:${BRAND.heading};">${client}</strong> has expired.</p>
                 <p style="margin:12px 0 0 0;">If you still want to proceed, open the workspace and create a new revision with an updated valid-until date.</p>`,
      cta: { label: "View Proposal", url: options.workspaceUrl },
      footnote: "You're receiving this because you manage proposals on BuildPanda.",
    }),
  };
}

export function projectInviteEmail(options: {
  inviterName: string;
  projectName: string;
  url: string;
}): { subject: string; html: string } {
  const inviter = escapeHtml(options.inviterName);
  const project = escapeHtml(options.projectName);
  return {
    subject: `You've been invited to follow ${options.projectName} on BuildPanda`,
    html: renderEmail({
      preview: `${options.inviterName} invited you to follow ${options.projectName}.`,
      heading: "Follow your build on BuildPanda",
      bodyHtml: `<p style="margin:0;"><strong style="color:${BRAND.heading};">${inviter}</strong> invited you to follow <strong style="color:${BRAND.heading};">${project}</strong>. You'll get your own portal to see progress, approve selections and ask questions.</p>`,
      cta: { label: "Open My Portal", url: options.url },
      footnote:
        "If you weren't expecting this invitation, you can safely ignore this email.",
    }),
  };
}

export function rfiDistributionEmail(options: {
  recipientName: string;
  projectName: string;
  rfiNumber: number;
  rfiSubject: string;
  question: string;
  replyUrl: string;
}): { subject: string; html: string } {
  const recipient = escapeHtml(options.recipientName);
  const project = escapeHtml(options.projectName);
  const subjectText = escapeHtml(options.rfiSubject);
  const question = escapeHtml(options.question);
  return {
    subject: `RFI-${options.rfiNumber}: ${options.rfiSubject} (${options.projectName})`,
    html: renderEmail({
      preview: `You've been asked to respond to RFI-${options.rfiNumber} on ${options.projectName}.`,
      heading: `RFI-${options.rfiNumber}: ${subjectText}`,
      bodyHtml: `<p style="margin:0;">Hi ${recipient},</p>
                 <p style="margin:12px 0 0 0;">You've been asked to respond to a Request for Information on <strong style="color:${BRAND.heading};">${project}</strong>.</p>
                 <p style="margin:12px 0 0 0;color:${BRAND.heading};"><strong>Question</strong></p>
                 <p style="margin:4px 0 0 0;">${question}</p>
                 <p style="margin:12px 0 0 0;">Click below to submit your response. No account or login is required.</p>`,
      cta: { label: "Respond to this RFI", url: options.replyUrl },
      footnote:
        "This response link is single-use and expires in 14 days. If you weren't expecting this, you can safely ignore this email.",
    }),
  };
}

export function rfiBallInCourtEmail(options: {
  recipientName: string;
  projectName: string;
  rfiNumber: number;
  rfiSubject: string;
  question: string;
  url: string;
}): { subject: string; html: string } {
  const recipient = escapeHtml(options.recipientName);
  const project = escapeHtml(options.projectName);
  const subjectText = escapeHtml(options.rfiSubject);
  const question = escapeHtml(options.question);
  return {
    subject: `You've been set as the ball-in-court owner for RFI-${options.rfiNumber} on ${options.projectName}.`,
    html: renderEmail({
      preview: `You've been set as the ball-in-court owner for RFI-${options.rfiNumber} on ${options.projectName}.`,
      heading: `RFI-${options.rfiNumber}: ${subjectText}`,
      bodyHtml: `<p style="margin:0;">Hi ${recipient},</p>
                 <p style="margin:12px 0 0 0;">You've been set as the ball-in-court owner for RFI-${options.rfiNumber} on <strong style="color:${BRAND.heading};">${project}</strong>.</p>
                 <p style="margin:12px 0 0 0;color:${BRAND.heading};"><strong>Question</strong></p>
                 <p style="margin:4px 0 0 0;">${question}</p>
                 <p style="margin:12px 0 0 0;">Open the RFI in BuildPanda to review the details and keep the response moving.</p>`,
      cta: { label: "View RFI", url: options.url },
      footnote: "You're receiving this because you were assigned as the ball-in-court owner on BuildPanda.",
    }),
  };
}

export interface NotificationEmailOptions {
  recipientName: string;
  eyebrow: string;
  heading: string;
  message: string;
  accent?: EmailAccent;
  badge?: { label: string; accent?: EmailAccent };
  meta?: { label: string; value: string }[];
  cta: { label: string; url: string };
  projectName?: string;
}

export function notificationEmail(
  options: NotificationEmailOptions,
): { subject: string; html: string } {
  const greeting = options.recipientName
    ? `<p style="margin:0 0 16px 0;">Hi ${escapeHtml(options.recipientName)},</p>`
    : "";
  const badgeHtml = options.badge
    ? `<p style="margin:0 0 16px 0;">${statusBadge(options.badge.label, options.badge.accent ?? options.accent ?? "brand")}</p>`
    : "";
  const messageHtml = `<p style="margin:0 0 8px 0;">${escapeHtml(options.message)}</p>`;
  const metaHtml = options.meta && options.meta.length
    ? metaTable(options.meta.map((m) => infoRow(m.label, m.value)).join(""))
    : "";
  const projectLine = options.projectName
    ? `\u00b7 ${options.projectName}`
    : "";
  return {
    subject: `${options.heading}${projectLine ? ` ${projectLine}` : ""}`,
    html: renderEmail({
      preview: options.message,
      eyebrow: options.eyebrow,
      heading: options.heading,
      accent: options.accent ?? "brand",
      bodyHtml: `${greeting}${badgeHtml}${messageHtml}${metaHtml}`,
      cta: options.cta,
      footnote:
        "You're receiving this because of your notification settings. Manage your email preferences in BuildPanda under Settings → Notifications.",
    }),
  };
}
