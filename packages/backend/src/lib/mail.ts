import { SendMailClient } from "zeptomail";

const client = new SendMailClient({
  url: "api.zeptomail.com/",
  token: process.env["ZEPTOMAIL_TOKEN"] ?? "",
});

const fromAddress = process.env["ZEPTOMAIL_FROM_ADDRESS"] ?? "noreply@buildpanda.com";
const fromName = process.env["ZEPTOMAIL_FROM_NAME"] ?? "BuildPanda";

export async function sendEmail(options: {
  to: string;
  toName?: string;
  subject: string;
  html: string;
}) {
  await client.sendMail({
    from: { address: fromAddress, name: fromName },
    to: [
      {
        email_address: {
          address: options.to,
          name: options.toName ?? "",
        },
      },
    ],
    subject: options.subject,
    htmlbody: options.html,
  });
}
