/**
 * <ac:emoticon ac:name="..."/> and <ac:macro-name ac:name="..."/>
 *
 * Confluence uses different element names for the same emoticon concept
 * depending on version. We accept any of: emoticon, cheese, smile, wink,
 * etc. — and look up a short alias table.
 */

import * as cheerio from "cheerio";
import type { RenderContext } from "../elements";
import { escapeAttr, escapeHtml } from "../sanitize";

const EMOJI: Record<string, string> = {
  smile: "😊",
  wink: "😉",
  laughing: "😂",
  grin: "😁",
  sad: "😢",
  cry: "😭",
  confused: "😕",
  surprised: "😮",
  tongue: "😛",
  cool: "😎",
  angry: "😠",
  shocked: "😱",
  evil: "😈",
  star: "⭐",
  thumbs_up: "👍",
  thumbs_up_: "👍",
  "thumbs-up": "👍",
  thumbs_down: "👎",
  "thumbs-down": "👎",
  information: "ℹ️",
  warning: "⚠️",
  check: "✔️",
  cross: "✖️",
  plus: "➕",
  minus: "➖",
  question: "❓",
  exclamation: "❗",
  cheese: "🧀",
  yellow_star: "⭐",
  red_star: "🌟",
  heart: "❤️",
  broken_heart: "💔",
  flag: "🚩",
  lightbulb: "💡",
  bulb: "💡",
  coffee: "☕",
  beer: "🍺",
  cake: "🍰",
  gift: "🎁",
};

export function renderEmoticonMacro(
  $: cheerio.CheerioAPI,
  el: cheerio.Cheerio<any>,
  _ctx: RenderContext,
  _params: Record<string, string>,
  _bodyHtml: string,
  _rawCdata: string,
): string {
  const raw = (
    el.attr("ac:name") ??
    el.attr("name") ??
    (el[0] as any).tagName?.replace(/^ac:/, "") ??
    ""
  ).toLowerCase();
  const glyph = EMOJI[raw] ?? EMOJI[raw.replace(/-/g, "_")] ?? "🙂";
  const fallback = raw || "emoticon";
  return `<span class="cf-emoticon" title="${escapeAttr(fallback)}">${glyph}</span>`;
}