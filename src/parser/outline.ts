/**
 * Outline (table-of-contents) extraction and rendering.
 *
 * The outline is computed during parsing by walking the same node tree that
 * produces the rendered HTML, so anchors stay consistent. Each node also
 * records its byte offset in the original source so the extension can
 * reveal the matching editor position.
 */

import type { Cheerio } from "cheerio";
import { slugify } from "./sanitize";

export interface OutlineNode {
  id: string;
  level: number; // 1..6
  text: string;
  children: OutlineNode[];
  /** Offset of the heading tag in the original source, when locatable. */
  sourceOffset?: number;
}

interface MutableOutlineNode {
  id: string;
  level: number;
  text: string;
  children: MutableOutlineNode[];
  sourceOffset?: number;
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
 * Blank out regions whose text content must not be mistaken for headings:
 * comments, CDATA, script/style bodies, macro parameters and plain-text
 * bodies. Replacement preserves length so offsets stay valid.
 */
function maskNonHeadingRegions(source: string): string {
  const blank = (m: string) => " ".repeat(m.length);
  return source
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, blank)
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, blank)
    .replace(/<ac:parameter\b[^>]*>[\s\S]*?<\/ac:parameter\s*>/gi, blank)
    .replace(/<ac:plain-text-body\b[^>]*>[\s\S]*?<\/ac:plain-text-body\s*>/gi, blank);
}

/**
 * Helper used inside the recursive renderer: collect headings from cheerio nodes.
 *
 * Ids are `h-<slug>-<n>` where n counts occurrences of the same slug, so
 * they are unique AND stable while unrelated parts of the document change.
 */
export function makeOutlineCollector(source: string) {
  const root: MutableOutlineNode[] = [];
  const flat: MutableOutlineNode[] = [];
  const slugCounts = new Map<string, number>();
  return {
    collect(level: number, _el: Cheerio<any>, text: string): string {
      const slug = slugify(text);
      const n = (slugCounts.get(slug) ?? 0) + 1;
      slugCounts.set(slug, n);
      const id = `h-${slug}-${n}`;
      const node: MutableOutlineNode = { id, level, text, children: [] };
      insertOutlineNode(root, node);
      flat.push(node);
      return id;
    },
    finalize(): OutlineNode[] {
      const masked = maskNonHeadingRegions(source);
      const re = /<h[1-6](?:\s[^>]*)?\/?>/gi;
      let m: RegExpExecArray | null;
      let i = 0;
      while ((m = re.exec(masked)) !== null && i < flat.length) {
        flat[i]!.sourceOffset = m.index;
        i++;
      }
      return root as OutlineNode[];
    },
  };
}