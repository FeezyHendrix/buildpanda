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
  heading: "#111827",
  body: "#4b5563",
  muted: "#9ca3af",
  background: "#F4F6FB",
  card: "#ffffff",
  border: "#E6EDFD",
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

interface EmailContent {
  /** Preheader shown next to the subject in inbox previews. Plain text. */
  preview: string;
  heading: string;
  /** Already-escaped/trusted HTML for the body paragraphs. */
  bodyHtml: string;
  cta: { label: string; url: string };
  /** Small print under the CTA, e.g. expiry / "ignore this" note. Plain text. */
  footnote: string;
}

function renderEmail(content: EmailContent): string {
  const year = new Date().getFullYear();
  const ctaUrl = escapeHtml(content.cta.url);
  // The plain-link fallback only makes sense for web links (not mailto: etc).
  const linkFallback = content.cta.url.startsWith("http")
    ? `<p style="margin:0 0 8px 0;font-family:${FONT_STACK};font-size:13px;line-height:1.6;color:${BRAND.muted};">
                Or copy and paste this link into your browser:
              </p>
              <p style="margin:0 0 24px 0;font-family:${FONT_STACK};font-size:13px;line-height:1.6;word-break:break-all;">
                <a href="${ctaUrl}" target="_blank" style="color:${BRAND.primary};text-decoration:underline;">${ctaUrl}</a>
              </p>`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${escapeHtml(content.heading)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&display=swap" rel="stylesheet" />
</head>
<body style="margin:0;padding:0;background-color:${BRAND.background};">
  <!-- Preheader: hidden inbox preview text -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(content.preview)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.background};">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
          <!-- Logo -->
          <tr>
            <td align="center" style="padding:0 0 28px 0;">
              <a href="${escapeHtml(config.mail.appUrl)}" target="_blank" style="text-decoration:none;">
                <img src="${escapeHtml(config.mail.logoUrl)}" width="132" height="48" alt="BuildPanda"
                  style="display:block;border:0;outline:none;width:132px;height:48px;font-family:${FONT_STACK};font-size:22px;font-weight:700;color:${BRAND.primary};" />
              </a>
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td style="background-color:${BRAND.card};border:1px solid ${BRAND.border};border-radius:16px;padding:40px;">
              <h1 style="margin:0 0 16px 0;font-family:${FONT_STACK};font-size:22px;line-height:1.3;font-weight:700;color:${BRAND.heading};">
                ${escapeHtml(content.heading)}
              </h1>
              <div style="font-family:${FONT_STACK};font-size:15px;line-height:1.65;color:${BRAND.body};">
                ${content.bodyHtml}
              </div>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0;">
                <tr>
                  <td align="center" style="background-color:${BRAND.primary};border-radius:10px;">
                    <a href="${ctaUrl}" target="_blank"
                      style="display:inline-block;padding:14px 32px;font-family:${FONT_STACK};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">
                      ${escapeHtml(content.cta.label)}
                    </a>
                  </td>
                </tr>
              </table>
              ${linkFallback}
              <hr style="border:none;border-top:1px solid ${BRAND.border};margin:0 0 20px 0;" />
              <p style="margin:0;font-family:${FONT_STACK};font-size:13px;line-height:1.6;color:${BRAND.muted};">
                ${escapeHtml(content.footnote)}
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding:28px 16px 0 16px;">
              <p style="margin:0 0 4px 0;font-family:${FONT_STACK};font-size:12px;line-height:1.6;color:${BRAND.muted};">
                &copy; ${year} BuildPanda. All rights reserved.
              </p>
              <p style="margin:0;font-family:${FONT_STACK};font-size:12px;line-height:1.6;color:${BRAND.muted};">
                Manage every build with confidence.
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
