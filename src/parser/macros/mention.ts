/**
 * <ac:structured-macro ac:name="user-mention"> — @user link.
 *
 * Parameter naming varies across Confluence versions: account-id /
 * accountid / userKey / username, display-name / displayname.
 */

import * as cheerio from "cheerio";
import type { RenderContext } from "../elements";
import { escapeAttr, escapeHtml } from "../sanitize";

export function renderUserMentionMacro(
  $: cheerio.CheerioAPI,
  _el: cheerio.Cheerio<any>,
  _ctx: RenderContext,
  params: Record<string, string>,
  _bodyHtml: string,
  _rawCdata: string,
): string {
  const user =
    params["username"] ??
    params["account-id"] ??
    params["accountid"] ??
    params["userKey"] ??
    params["userkey"] ??
    "user";
  const display =
    params["display-name"] ?? params["displayname"] ?? params["displayName"] ?? user;
  return `<span class="cf-user-mention" title="${escapeAttr(user)}">@${escapeHtml(display)}</span>`;
}