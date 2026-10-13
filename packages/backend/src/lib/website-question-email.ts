import { BRAND, escapeHtml, FONT_STACK, renderEmail } from "./email-templates.ts";

export interface WebsiteQuestion {
  email: string;
  question: string;
  name?: string | null;
}

/** A question asked in the website's FAQ box that the FAQ did not answer. */
export function websiteQuestionEmail(q: WebsiteQuestion): { subject: string; html: string } {
  const who = q.name?.trim() || q.email;
  return {
    // Line breaks in a subject become extra mail headers; the caller has
    // already stripped them, and this keeps it true for any other caller.
    subject: `Website question from ${who}`.replace(/[\r\n]+/g, " ").slice(0, 150),
    html: renderEmail({
      preview: q.question.slice(0, 120),
      heading: "New question from buildpanda.io",
      bodyHtml: `<p style="margin:0 0 16px 0;">${escapeHtml(who)} asked this on the website FAQ and did not find an answer:</p>
                 <blockquote style="margin:0 0 16px 0;padding:12px 16px;border-left:3px solid ${BRAND.border};font-family:${FONT_STACK};font-size:14px;color:${BRAND.heading};white-space:pre-wrap;">${escapeHtml(q.question)}</blockquote>`,
      cta: {
        label: `Reply to ${who}`,
        url: `mailto:${encodeURIComponent(q.email)}?subject=${encodeURIComponent("Your question to BuildPanda")}`,
      },
      footnote: "You're receiving this because you're listed as the consultation contact for buildpanda.io.",
    }),
  };
}
