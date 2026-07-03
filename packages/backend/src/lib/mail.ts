import { SendMailClient } from "zeptomail";
import { config } from "../config/index.ts";
import { logger } from "./logger.ts";
import { captureBug } from "./sentry.ts";

/**
 * ZeptoMail transactional email client.
 * Docs: https://www.zoho.com/zeptomail/help/api/email-sending.html
 *
 * The token comes from ZEPTOMAIL_TOKEN (a "Zoho-enczapikey ..." send mail
 * token). When it's not configured (local dev), emails are logged to the
 * console instead of sent so auth flows remain testable — the verification /
 * reset link is printed in the log line.
 */
const ZEPTOMAIL_API_URL = "https://api.zeptomail.com/v1.1/email";

const client = config.mail.token
  ? new SendMailClient({ url: ZEPTOMAIL_API_URL, token: config.mail.token })
  : null;

export interface EmailAttachment {
  /** Raw file bytes; encoded to base64 for the ZeptoMail payload. */
  content: Buffer;
  name: string;
  mimeType: string;
}

export interface SendEmailOptions {
  /** One or more recipient addresses. */
  to: string | string[];
  /** Display name — applied to the first recipient only. */
  toName?: string;
  cc?: string[];
  bcc?: string[];
  subject: string;
  html: string;
  text?: string;
  from?: { address: string; name: string };
  replyTo?: { address: string; name: string };
  attachments?: EmailAttachment[];
}

function htmlToText(html: string): string {
  return html
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href, label) => {
      const text = label.replace(/<[^>]+>/g, "").trim();
      return text && href && text !== href ? `${text} (${href})` : href || text;
    })
    .replace(/<\/(p|div|tr|h[1-6]|li)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&copy;/g, "(c)")
    .replace(/&zwnj;/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function sendEmail(options: SendEmailOptions): Promise<void> {
  const recipients = Array.isArray(options.to) ? options.to : [options.to];
  const text = options.text ?? htmlToText(options.html);

  if (!client) {
    const links = options.html.match(/href="([^"]+)"/g) ?? [];
    const attached = options.attachments?.map((file) => file.name) ?? [];
    logger.warn(
      { to: recipients, cc: options.cc, bcc: options.bcc, subject: options.subject, links, attachments: attached },
      "[mail] ZEPTOMAIL_TOKEN not set — skipping send",
    );
    return;
  }

  try {
    const attachments = options.attachments?.map((file) => ({
      content: file.content.toString("base64"),
      mime_type: file.mimeType,
      name: file.name,
    }));
    const response = await client.sendMail({
      from: options.from ?? { address: config.mail.fromAddress, name: config.mail.fromName },
      reply_to: [
        options.replyTo ?? { address: config.mail.replyToAddress, name: config.mail.fromName },
      ],
      to: recipients.map((address, index) => ({
        email_address: {
          address,
          name: (index === 0 && options.toName) || address,
        },
      })),
      ...(options.cc && options.cc.length > 0
        ? { cc: options.cc.map((address) => ({ email_address: { address, name: address } })) }
        : {}),
      ...(options.bcc && options.bcc.length > 0
        ? { bcc: options.bcc.map((address) => ({ email_address: { address, name: address } })) }
        : {}),
      subject: options.subject,
      htmlbody: options.html,
      textbody: text,
      ...(attachments && attachments.length > 0 ? { attachments } : {}),
    });
    const requestId =
      (response as { request_id?: string } | undefined)?.request_id ?? "unknown";
    logger.info(
      { to: recipients, subject: options.subject, requestId },
      "[mail] Sent",
    );
  } catch (error) {
    // ZeptoMail rejections arrive as objects with an `error.details` payload;
    // surface them as real Errors so callers/loggers get a useful message.
    const detail =
      error instanceof Error ? error.message : JSON.stringify(error);
    // Trial-plan / daily-quota exhaustion (TM_3601 / SM_133 / SMI_115) silently
    // takes down sign-up verification and invites — page ops, don't just log.
    if (/TM_3601|SM_133|SMI_115|limit/i.test(detail)) {
      captureBug(new Error(`ZeptoMail quota exhausted: ${detail}`), {
        extra: { subject: options.subject },
      });
      logger.error(
        { to: options.to, subject: options.subject, detail },
        "[mail] SEND QUOTA EXHAUSTED — verification/invite emails are failing",
      );
    } else {
      logger.error(
        { to: options.to, subject: options.subject, detail },
        "[mail] Failed to send",
      );
    }
    throw new Error(`Failed to send email: ${detail}`);
  }
}
