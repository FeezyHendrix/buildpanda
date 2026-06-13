import { SendMailClient } from "zeptomail";
import { config } from "../config/index.ts";

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

export interface SendEmailOptions {
  /** One or more recipient addresses. */
  to: string | string[];
  /** Display name — applied to the first recipient only. */
  toName?: string;
  subject: string;
  html: string;
  text?: string;
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
    console.warn(
      `[mail] ZEPTOMAIL_TOKEN not set — skipping send. to=${recipients.join(",")} subject="${options.subject}" links=${links.join(" ")}`,
    );
    return;
  }

  try {
    await client.sendMail({
      from: { address: config.mail.fromAddress, name: config.mail.fromName },
      reply_to: [
        { address: config.mail.replyToAddress, name: config.mail.fromName },
      ],
      to: recipients.map((address, index) => ({
        email_address: {
          address,
          name: (index === 0 && options.toName) || address,
        },
      })),
      subject: options.subject,
      htmlbody: options.html,
      textbody: text,
    });
  } catch (error) {
    // ZeptoMail rejections arrive as objects with an `error.details` payload;
    // surface them as real Errors so callers/loggers get a useful message.
    const detail =
      error instanceof Error ? error.message : JSON.stringify(error);
    console.error(
      `[mail] Failed to send "${options.subject}" to ${options.to}: ${detail}`,
    );
    throw new Error(`Failed to send email: ${detail}`);
  }
}
