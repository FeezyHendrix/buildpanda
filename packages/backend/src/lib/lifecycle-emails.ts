import { config } from "../config/index.ts";

export type LifecycleEmailType =
  | "welcome"
  | "activation_nudge"
  | "first_project"
  | "re_engagement";

interface RenderedEmail {
  subject: string;
  html: string;
  from: { address: string; name: string };
  replyTo: { address: string; name: string };
}

const MICHAEL = { address: "michael@buildpanda.io", name: "Michael from BuildPanda" };
const HELLO = { address: "hello@buildpanda.io", name: "David from BuildPanda" };

const FONT_STACK =
  "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function paragraphs(blocks: string[]): string {
  return blocks
    .map(
      (html) =>
        `<p style="margin:0 0 16px 0;font-family:${FONT_STACK};font-size:15px;line-height:1.7;color:#2A2A2A;">${html}</p>`,
    )
    .join("");
}

function signature(name: string, title: string): string {
  return `<p style="margin:24px 0 0 0;font-family:${FONT_STACK};font-size:15px;line-height:1.6;color:#2A2A2A;">${escapeHtml(name)}<br /><span style="color:#6B6B6B;">${escapeHtml(title)}</span></p>`;
}

function link(url: string): string {
  const safe = escapeHtml(url);
  return `<a href="${safe}" target="_blank" style="color:#004DE7;text-decoration:underline;word-break:break-all;">${safe}</a>`;
}

function shell(preview: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light only" />
  <title>BuildPanda</title>
</head>
<body style="margin:0;padding:0;background-color:#F4F6FB;-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(preview)}&nbsp;&zwnj;&nbsp;&zwnj;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F4F6FB;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
          <tr>
            <td style="background-color:#FFFFFF;border:1px solid #E7EAF3;border-radius:16px;padding:36px 40px;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:24px 24px 0 24px;">
              <p style="margin:0;font-family:${FONT_STACK};font-size:12px;line-height:1.6;color:#9AA1B1;">BuildPanda · Manage every build with confidence.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

interface Recipient {
  firstName: string;
  companyName: string;
}

export function welcomeEmail({ firstName, companyName }: Recipient): RenderedEmail {
  const body =
    paragraphs([
      `Hi ${escapeHtml(firstName)},`,
      `Michael here, CEO and co-founder of BuildPanda. I saw ${escapeHtml(companyName)} just created an account, and I wanted to welcome you personally.`,
      `Thanks for giving BuildPanda a look. We built it exactly for the kind of work you do: running real projects where the budget, the programme, the materials, and the client all need to stay on the same page, without living in ten different places.`,
      `Want to see how it all works? Here's a short walkthrough that takes you through setting up and running your first project: ${link(config.mail.walkthroughVideoUrl)}`,
      `Watch that, bring an existing job onto the platform, and you'll have a live project up in no time. If anything is unclear or you hit a block, just reply here. It comes straight to me.`,
      `Welcome on board.`,
    ]) + signature("Michael", "CEO, BuildPanda");
  return {
    subject: "Welcome to BuildPanda",
    html: shell("Welcome to BuildPanda — a personal note from Michael.", body),
    from: MICHAEL,
    replyTo: MICHAEL,
  };
}

export function activationNudgeEmail({ firstName, companyName }: Recipient): RenderedEmail {
  const body =
    paragraphs([
      `Hi ${escapeHtml(firstName)},`,
      `Michael again. I noticed ${escapeHtml(companyName)} hasn't set up a project yet, and I wanted to check in.`,
      `The hardest part is just starting the first one, and it's easier than most people expect. You don't build it from scratch. Bring an existing or upcoming job with your schedule and BoQ, and the platform parses your documents and builds the project structure for you.`,
      `If the walkthrough didn't make something clear, or you're stuck on a specific step, reply and tell me where the block is. I read every reply, and right now I'm personally helping our early users get their first project running.`,
    ]) + signature("Michael", "CEO, BuildPanda");
  return {
    subject: "Your first project on BuildPanda",
    html: shell("Getting the first project up is easier than it looks.", body),
    from: MICHAEL,
    replyTo: MICHAEL,
  };
}

export function firstProjectEmail({ firstName }: Recipient): RenderedEmail {
  const body =
    paragraphs([
      `Hi ${escapeHtml(firstName)},`,
      `Good to see your first project up on BuildPanda. The setup is the part most people put off, so that's the real work done.`,
      `A few things tend to go unnoticed in the first few days that are worth knowing early, because they're where the platform quietly does the most for you.`,
      `Panda AI is there to take the administrative weight off your plate. Rather than working through your documents by hand, you can lean on it to help structure the project, make sense of your schedule and BoQ, and handle the setup work that usually eats an afternoon. If there's something specific you're trying to get done, it's the fastest way to get there.`,
      `The materials and delay records build a picture for you as you go, without much effort. Logged consistently, they mean that when a question comes up weeks later, about what was used, what was delivered, what caused a holdup, the answer is already there. Nothing to reconstruct from memory.`,
      `And then there's the client view. This is the one people appreciate most once they feel it. Your client gets their own window into the project: real progress, where the budget is going, what's been verified. The practical effect is that the questions stop coming to you. They can see where their money is going for themselves, which heads off the second-guessing and the slow scope creep before either has a chance to start.`,
      `None of this needs to happen at once. But a project that's logged steadily from the start is one that runs itself far more than it should, and saves you the headaches that usually surface near the end.`,
      `If you'd like a hand making the most of any of it, just reply, and the right person on our team will get back to you.`,
      `Happy building,`,
    ]) + signature("The BuildPanda Team", "");
  return {
    subject: "You're set up. A few things worth knowing early.",
    html: shell("A few things worth knowing early on BuildPanda.", body),
    from: HELLO,
    replyTo: HELLO,
  };
}

export function reEngagementEmail({ firstName, companyName }: Recipient): RenderedEmail {
  const body =
    paragraphs([
      `Hi ${escapeHtml(firstName)},`,
      `Michael here, CEO at BuildPanda. ${escapeHtml(companyName)} signed up a couple of weeks ago, and I noticed you haven't had the chance to get a project running yet.`,
      `I know what that usually means. It's rarely a lack of interest, it's that a live job is already taking all your attention, and trying a new system isn't the thing that makes the week's list. That's fair.`,
      `So rather than another nudge, two honest options, whichever fits.`,
      `If the timing simply wasn't right, reply "still in" and we'll help you get a project set up properly, on your schedule, with someone walking you through it so it takes minutes rather than an afternoon.`,
      `If something about it didn't convince you, or it wasn't what you expected, I'd genuinely value a line on why. We're early, and the firms we're building this for are exactly the ones in the best position to tell us where it falls short. That kind of feedback is worth more to us than the signup.`,
      `Either way, thank you for giving us a look.`,
    ]) + signature("Michael", "CEO, BuildPanda");
  return {
    subject: `Is BuildPanda still worth a look for ${companyName}?`,
    html: shell("Two honest options, whichever fits.", body),
    from: MICHAEL,
    replyTo: HELLO,
  };
}
