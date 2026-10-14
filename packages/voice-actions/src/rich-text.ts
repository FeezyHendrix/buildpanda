import type { VoiceRichText } from './types.ts';

/** Plain-text mirror only; rendering uses the app's existing Lexical editor. */
export function richTextFromHtml(html: string): VoiceRichText {
  const text = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<\/?(?:p|div|li|h[1-6]|br|blockquote)\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, '').replace(/&nbsp;|&#160;|&#xA0;/gi, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&#(x[0-9a-f]+|\d+);/gi, (entity, number: string) => {
      const code = number[0]?.toLowerCase() === 'x' ? parseInt(number.slice(1), 16) : Number(number);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
    }).replace(/&amp;/g, '&')
    .replace(/[\s\u200B-\u200D\uFEFF]+/g, ' ').trim();
  return { html, text };
}

/** Model output is spoken text, never executable HTML or fabricated attachments. */
export function spokenRichText(text: string): VoiceRichText {
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return richTextFromHtml(`<p>${escaped.replace(/\n/g, '<br>')}</p>`);
}

export function isVoiceRichText(value: unknown): value is VoiceRichText {
  return !!value && typeof value === 'object' && 'html' in value && typeof value.html === 'string' &&
    'text' in value && typeof value.text === 'string' && value.text === richTextFromHtml(value.html).text;
}
