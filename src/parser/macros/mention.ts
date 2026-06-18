/**
 * <ac:structured-macro ac:name="user-mention"> — @user link.
 */

import * as cheerio from "cheerio";
import type { RenderContext } from "../elements";
import { escapeHtml } from "../sanitize";

export function renderUserMentionMacro(
  $: cheerio.CheerioAPI,
  _el: cheerio.Cheerio<any>,
  _ctx: RenderContext,
  params: Record<string, string>,
  _bodyHtml: string,
  _rawCdata: string,
): string {
  const user = params["username"] ?? params["accountid"] ?? "user";
  const display = params["displayname"] ?? user;
  return `<span class="cf-user-mention">@${escapeHtml(display)}</span>`;
}