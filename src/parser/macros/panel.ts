/**
 * <ac:structured-macro ac:name="panel"> — generic bordered panel.
 * Also handles note/info/warning/tip as variations of this same pattern.
 */

import * as cheerio from "cheerio";
import type { RenderContext } from "../elements";
import { escapeAttr, escapeHtml } from "../sanitize";
import { renderChildren } from "../elements";

type Variant = "panel" | "note" | "info" | "warning" | "tip";

export function renderPanelMacro(
  $: cheerio.CheerioAPI,
  el: cheerio.Cheerio<any>,
  ctx: RenderContext,
  params: Record<string, string>,
  bodyHtml: string,
  _rawCdata: string,
): string {
  return renderCallout($, "panel", params, bodyHtml);
}

export function renderNoteMacro(
  $: cheerio.CheerioAPI,
  el: cheerio.Cheerio<any>,
  ctx: RenderContext,
  params: Record<string, string>,
  bodyHtml: string,
  _rawCdata: string,
): string {
  return renderCallout($, "note", params, bodyHtml);
}
export function renderInfoMacro(
  $: cheerio.CheerioAPI,
  el: cheerio.Cheerio<any>,
  ctx: RenderContext,
  params: Record<string, string>,
  bodyHtml: string,
  _rawCdata: string,
): string {
  return renderCallout($, "info", params, bodyHtml);
}
export function renderWarningMacro(
  $: cheerio.CheerioAPI,
  el: cheerio.Cheerio<any>,
  ctx: RenderContext,
  params: Record<string, string>,
  bodyHtml: string,
  _rawCdata: string,
): string {
  return renderCallout($, "warning", params, bodyHtml);
}
export function renderTipMacro(
  $: cheerio.CheerioAPI,
  el: cheerio.Cheerio<any>,
  ctx: RenderContext,
  params: Record<string, string>,
  bodyHtml: string,
  _rawCdata: string,
): string {
  return renderCallout($, "tip", params, bodyHtml);
}

function renderCallout(
  $: cheerio.CheerioAPI,
  variant: Variant,
  params: Record<string, string>,
  bodyHtml: string,
): string {
  const title = params["title"] ?? defaultTitle(variant);
  const icon = iconFor(variant);

  let styleAttr = "";
  if (variant === "panel") {
    const borderColor = params["borderColor"] ?? params["bordercolor"];
    const borderStyle = params["borderStyle"] ?? params["borderstyle"];
    const borderWidth = params["borderWidth"] ?? params["borderwidth"];
    const titleBG = params["titleBGColor"] ?? params["titlebgcolor"];
    const titleColor = params["titleColor"] ?? params["titlecolor"];

    const styles: string[] = [];
    if (borderColor) styles.push(`--cf-panel-border: ${escapeAttr(borderColor)}`);
    if (borderStyle) styles.push(`--cf-panel-border-style: ${escapeAttr(borderStyle)}`);
    if (borderWidth) styles.push(`--cf-panel-border-width: ${escapeAttr(borderWidth)}`);
    if (titleBG) styles.push(`--cf-panel-title-bg: ${escapeAttr(titleBG)}`);
    if (titleColor) styles.push(`--cf-panel-title-color: ${escapeAttr(titleColor)}`);
    if (styles.length > 0) styleAttr = ` style="${styles.join("; ")}"`;
  }

  const titleHtml = title
    ? `<div class="cf-callout-title"><span class="cf-callout-icon">${icon}</span><span>${escapeHtml(
        title,
      )}</span></div>`
    : `<div class="cf-callout-title"><span class="cf-callout-icon">${icon}</span><span>${escapeHtml(
        defaultTitle(variant),
      )}</span></div>`;

  return `<div class="cf-callout cf-callout-${variant}"${styleAttr}>${titleHtml}<div class="cf-callout-body">${bodyHtml}</div></div>`;
}

function defaultTitle(v: Variant): string {
  switch (v) {
    case "note":
      return "Note";
    case "info":
      return "Info";
    case "warning":
      return "Warning";
    case "tip":
      return "Tip";
    case "panel":
      return "";
  }
}

function iconFor(v: Variant): string {
  switch (v) {
    case "note":
      return "📝";
    case "info":
      return "ℹ️";
    case "warning":
      return "⚠️";
    case "tip":
      return "💡";
    case "panel":
      return "▣";
  }
}