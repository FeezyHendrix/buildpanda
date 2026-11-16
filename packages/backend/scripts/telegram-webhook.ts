import { pathToFileURL } from "node:url";
import { z } from "zod";

export async function configureTelegramWebhook(env: NodeJS.ProcessEnv, register = false, fetcher: typeof fetch = fetch) {
  const token = env.TELEGRAM_BOT_TOKEN ?? "";
  const botId = env.TELEGRAM_BOT_ID ?? "";
  const username = env.TELEGRAM_BOT_USERNAME ?? "";
  const secret = env.TELEGRAM_WEBHOOK_SECRET ?? "";
  if (!/^[1-9]\d*:[A-Za-z0-9_-]{20,}$/.test(token)) throw new Error("TELEGRAM_BOT_TOKEN is missing or invalid");
  if (!/^[1-9]\d*$/.test(botId) || !Number.isSafeInteger(Number(botId))) throw new Error("TELEGRAM_BOT_ID must be a positive safe integer");
  if (token.split(":")[0] !== botId) throw new Error("TELEGRAM_BOT_TOKEN does not match TELEGRAM_BOT_ID");
  if (!/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(username)) throw new Error("TELEGRAM_BOT_USERNAME must be a username without @");
  if (!/^[A-Za-z0-9_-]{32,256}$/.test(secret)) throw new Error("TELEGRAM_WEBHOOK_SECRET must contain 32–256 letters, digits, underscores or hyphens");

  let origin: URL;
  try {
    origin = new URL(env.PUBLIC_API_URL ?? "");
  } catch {
    throw new Error("PUBLIC_API_URL must be a public HTTPS origin");
  }
  if (origin.protocol !== "https:" || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash
    || !["", "443", "80", "88", "8443"].includes(origin.port)) {
    throw new Error("PUBLIC_API_URL must be an HTTPS origin on a supported Telegram webhook port, without credentials, path, query or fragment");
  }
  const webhookUrl = new URL("/telegram/webhook", origin).href;

  async function request(method: string, body = {}) {
    // Telegram puts the credential in its API path; never expose transport errors or response bodies.
    try {
      const response = await fetcher(`https://api.telegram.org/bot${token}/${method}`, {
        method: "POST", redirect: "error", signal: AbortSignal.timeout(15_000),
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error();
      const parsed = z.object({ ok: z.literal(true), result: z.unknown() }).safeParse(await response.json());
      if (!parsed.success) throw new Error();
      return parsed.data.result;
    } catch {
      throw new Error(`Telegram ${method} failed; transport details and response omitted`);
    }
  }

  const identity = z.object({ id: z.number().int().positive().safe(), is_bot: z.literal(true), username: z.string() }).safeParse(await request("getMe"));
  if (!identity.success || String(identity.data.id) !== botId || identity.data.username.toLowerCase() !== username.toLowerCase()) {
    throw new Error("Telegram getMe identity does not match TELEGRAM_BOT_ID and TELEGRAM_BOT_USERNAME");
  }
  if (register) {
    const result = await request("setWebhook", {
      url: webhookUrl, secret_token: secret, allowed_updates: ["message"], drop_pending_updates: false,
    });
    if (result !== true) throw new Error("Telegram setWebhook did not confirm registration");
  }
  const webhook = z.object({
    url: z.string(), pending_update_count: z.number().int().nonnegative(),
    allowed_updates: z.array(z.string()).optional(), last_error_date: z.number().optional(),
  }).safeParse(await request("getWebhookInfo"));
  if (!webhook.success) throw new Error("Telegram getWebhookInfo returned an invalid result; response omitted");
  return {
    registered: register,
    webhookMatches: webhook.data.url === webhookUrl && webhook.data.allowed_updates?.length === 1 && webhook.data.allowed_updates[0] === "message",
    pendingUpdates: webhook.data.pending_update_count,
    hasRecordedDeliveryError: webhook.data.last_error_date !== undefined,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !["--check", "--register"].includes(args[0]!)) {
    process.stderr.write("Usage: tsx scripts/telegram-webhook.ts --check|--register (credentials come from environment variables)\n");
    process.exitCode = 1;
  } else {
    configureTelegramWebhook(process.env, args[0] === "--register").then((result) => {
      process.stdout.write(`${JSON.stringify({ identityVerified: true, ...result })}\n`);
      if (!result.webhookMatches) process.exitCode = 1;
    }).catch((error: unknown) => {
      process.stderr.write(`${error instanceof Error ? error.message : "Telegram webhook operation failed"}\n`);
      process.exitCode = 1;
    });
  }
}
