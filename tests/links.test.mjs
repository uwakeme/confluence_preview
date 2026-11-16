import test from "node:test";
import assert from "node:assert/strict";
import {
  isAllowedExternalHref,
  sanitizeHref,
  buildPageUrl,
  buildJiraUrl,
} from "./parser.bundle.mjs";

test("isAllowedExternalHref accepts only http/https/mailto", () => {
  assert.equal(isAllowedExternalHref("https://example.com"), true);
  assert.equal(isAllowedExternalHref("http://example.com/x?y=1"), true);
  assert.equal(isAllowedExternalHref("mailto:a@b.com"), true);
  assert.equal(isAllowedExternalHref("javascript:alert(1)"), false);
  assert.equal(isAllowedExternalHref("data:text/html,x"), false);
  assert.equal(isAllowedExternalHref("file:///etc/passwd"), false);
  assert.equal(isAllowedExternalHref("ftp://example.com"), false);
  assert.equal(isAllowedExternalHref("vscode://file/x"), false);
  assert.equal(isAllowedExternalHref("not a url"), false);
  assert.equal(isAllowedExternalHref("//example.com"), false);
  assert.equal(isAllowedExternalHref(""), false);
});

test("sanitizeHref neutralizes script-bearing schemes only", () => {
  assert.equal(sanitizeHref("javascript:alert(1)"), "#");
  assert.equal(sanitizeHref("  JavaScript:alert(1)"), "#");
  assert.equal(sanitizeHref("data:text/html,x"), "#");
  assert.equal(sanitizeHref("vbscript:x"), "#");
  assert.equal(sanitizeHref("https://example.com"), "https://example.com");
  assert.equal(sanitizeHref("#anchor"), "#anchor");
  assert.equal(sanitizeHref("relative/path.html"), "relative/path.html");
  assert.equal(sanitizeHref("mailto:a@b.com"), "mailto:a@b.com");
});

test("buildPageUrl builds /display/SPACE/Title URLs", () => {
  assert.equal(
    buildPageUrl("https://c.example.com", "DEV", "Setup Guide"),
    "https://c.example.com/display/DEV/Setup%20Guide",
  );
  assert.equal(
    buildPageUrl("https://c.example.com/", "DEV", "Setup Guide", "intro"),
    "https://c.example.com/display/DEV/Setup%20Guide#intro",
  );
  assert.equal(
    buildPageUrl("https://c.example.com", "DEV", "中文 页面"),
    "https://c.example.com/display/DEV/%E4%B8%AD%E6%96%87%20%E9%A1%B5%E9%9D%A2",
  );
});

test("buildPageUrl requires an http(s) base and a space key", () => {
  assert.equal(buildPageUrl("", "DEV", "T"), undefined);
  assert.equal(buildPageUrl(undefined, "DEV", "T"), undefined);
  assert.equal(buildPageUrl("ftp://c.example.com", "DEV", "T"), undefined);
  assert.equal(buildPageUrl("https://c.example.com", "", "T"), undefined);
  assert.equal(buildPageUrl("https://c.example.com", undefined, "T"), undefined);
});

test("buildJiraUrl builds /browse/KEY URLs", () => {
  assert.equal(buildJiraUrl("https://j.example.com", "PROJ-1"), "https://j.example.com/browse/PROJ-1");
  assert.equal(buildJiraUrl("https://j.example.com/", "PROJ-1"), "https://j.example.com/browse/PROJ-1");
  assert.equal(buildJiraUrl("", "PROJ-1"), undefined);
  assert.equal(buildJiraUrl("https://j.example.com", ""), undefined);
  assert.equal(buildJiraUrl("javascript:alert(1)", "PROJ-1"), undefined);
});