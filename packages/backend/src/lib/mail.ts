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
}

export async function sendEmail(options: SendEmailOptions): Promise<void> {
  const recipients = Array.isArray(options.to) ? options.to : [options.to];

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
      to: recipients.map((address, index) => ({
        email_address: {
          address,
          name: (index === 0 && options.toName) || address,
        },
      })),
      subject: options.subject,
      htmlbody: options.html,
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
