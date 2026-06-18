/**
 * Outline (table-of-contents) extraction and rendering.
 *
 * The outline is computed during parsing by walking the same node tree that
 * produces the rendered HTML, so anchors stay consistent.
 */

import type { Cheerio } from "cheerio";
import { slugify } from "./sanitize";

export interface OutlineNode {
  id: string;
  level: number; // 1..6
  text: string;
  children: OutlineNode[];
}

interface MutableOutlineNode {
  id: string;
  level: number;
  text: string;
  children: MutableOutlineNode[];
}

/**
 * Insert a heading node into a tree at the right level.
 */
function insertOutlineNode(
  root: MutableOutlineNode[],
  node: MutableOutlineNode,
): void {
  // Find the deepest last-child whose level is < node.level
  let parentList: MutableOutlineNode[] = root;
  while (parentList.length > 0) {
    const last = parentList[parentList.length - 1]!;
    if (last.level < node.level) {
      parentList = last.children;
    } else {
      break;
    }
  }
  parentList.push(node);
}

/**
 * Render a single outline node as <li><a>…</a><ul>…</ul></li>.
 */
function renderOutlineNode(node: OutlineNode): string {
  const indent = "  ".repeat(node.level);
  const text = escapeText(node.text);
  let html = `${indent}<li><a class="outline-link" href="#${escapeAttr(node.id)}" data-target="${escapeAttr(node.id)}">${text}</a>`;
  if (node.children.length > 0) {
    html += `\n${indent}  <ul class="outline-children">\n${node.children
      .map(renderOutlineNode)
      .join("\n")}\n${indent}  </ul>`;
  }
  html += `</li>`;
  return html;
}

export function renderOutline(nodes: OutlineNode[]): string {
  if (nodes.length === 0) return "";
  return `<ul class="outline-root">\n${nodes.map(renderOutlineNode).join("\n")}\n</ul>`;
}

/**
 * Helper used inside the recursive renderer: collect headings from cheerio nodes.
 *
 * We pass the same cheerio element we already render so heading text matches
 * what the user sees.
 */
export function makeOutlineCollector() {
  const root: MutableOutlineNode[] = [];
  return {
    collect(level: number, el: Cheerio<any>, text: string): string {
      const id = `h-${slugify(text)}-${root.length + 1}`;
      const node: MutableOutlineNode = { id, level, text, children: [] };
      insertOutlineNode(root, node);
      return id;
    },
    finalize(): OutlineNode[] {
      return root as OutlineNode[];
    },
  };
}

function escapeText(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
}
function escapeAttr(s: string): string {
  return s.replace(/"/g, "&quot;");
}