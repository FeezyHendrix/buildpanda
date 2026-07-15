import { SendByte, SendByteError } from "@sendbyte/node";
import { config } from "../config/index.ts";
import { logger } from "./logger.ts";
import { captureBug } from "./sentry.ts";

/**
 * SendByte transactional email client.
 * Docs: https://docs.sendbyte.africa/sdks/node
 *
 * The key comes from SENDBYTE_API_KEY (an "sk_live_..." / "sk_test_..." API
 * key). When it's not configured (local dev), emails are logged to the console
 * instead of sent so auth flows remain testable — the verification / reset
 * link is printed in the log line.
 */
const client = config.mail.token ? new SendByte(config.mail.token) : null;

/**
 * SendByte takes the sender as a single `"Name <address>"` string. Fall back to
 * a bare address when no display name is present.
 */
function formatSender(sender: { address: string; name?: string }): string {
  return sender.name ? `${sender.name} <${sender.address}>` : sender.address;
}

export interface EmailAttachment {
  /** Raw file bytes; encoded to base64 for the SendByte payload. */
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
      "[mail] SENDBYTE_API_KEY not set — skipping send",
    );
    return;
  }

  try {
    const attachments = options.attachments?.map((file) => ({
      content: file.content.toString("base64"),
      content_type: file.mimeType,
      filename: file.name,
    }));
    const sender = options.from ?? {
      address: config.mail.fromAddress,
      name: config.mail.fromName,
    };
    const replyTo =
      options.replyTo ?? { address: config.mail.replyToAddress, name: config.mail.fromName };
    const { id } = await client.emails.send({
      from: formatSender(sender),
      reply_to: replyTo.address,
      to: recipients,
      ...(options.cc && options.cc.length > 0 ? { cc: options.cc } : {}),
      ...(options.bcc && options.bcc.length > 0 ? { bcc: options.bcc } : {}),
      subject: options.subject,
      html: options.html,
      text,
      ...(attachments && attachments.length > 0 ? { attachments } : {}),
    });
    logger.info(
      { to: recipients, subject: options.subject, emailId: id },
      "[mail] Sent",
    );
  } catch (error) {
    const detail =
      error instanceof SendByteError
        ? `${error.code}: ${error.message}`
        : error instanceof Error
          ? error.message
          : JSON.stringify(error);
    if (/quota|limit|rate|insufficient|402|429/i.test(detail)) {
      captureBug(new Error(`SendByte quota exhausted: ${detail}`), {
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
