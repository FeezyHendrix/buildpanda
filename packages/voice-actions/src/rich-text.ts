import { plainTextFromHtml } from "@buildpanda/rich-content";
import type { VoiceRichText } from './types.ts';

/** Plain-text mirror only; rendering uses the app's existing Lexical editor. */
export function richTextFromHtml(html: string): VoiceRichText {
  return { html, text: plainTextFromHtml(html) };
}

export function spokenRichText(text: string): VoiceRichText {
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return richTextFromHtml(`<p>${escaped.replace(/\n/g, '<br>')}</p>`);
}

export function isVoiceRichText(value: unknown): value is VoiceRichText {
  return !!value && typeof value === 'object' && 'html' in value && typeof value.html === 'string' &&
    'text' in value && typeof value.text === 'string' && value.text === richTextFromHtml(value.html).text;
}
