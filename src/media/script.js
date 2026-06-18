/* ============================================================
   Confluence Preview — webview renderer script.
   Receives parsed HTML from the extension and renders it,
   wires up outline navigation + scroll sync.
   ============================================================ */

(function () {
  const vscode = acquireVsCodeApi();
  let currentOutline = [];

  function postMessage(msg) {
    vscode.postMessage(msg);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  }

  function getThemeClass() {
    // The body already has vscode-light/dark/high-contrast class
    // (added by extension host before rendering). But we also have to
    // detect dynamically if user switched themes after the panel opened.
    const cls = document.body.className || "";
    if (cls.includes("vscode-dark")) return "vscode-dark";
    if (cls.includes("vscode-high-contrast")) return "vscode-high-contrast";
    return "vscode-light";
  }

  function renderOutline(outline) {
    const container = document.getElementById("cf-outline");
    if (!container) return;
    if (!outline || outline.length === 0) {
      container.innerHTML = '<div class="cf-outline-empty">No headings found</div>';
      return;
    }
    container.innerHTML = renderOutlineNodes(outline);
  }

  function renderOutlineNodes(nodes) {
    return (
      "<ul class=\"outline-root\">" +
      nodes.map(renderOutlineNode).join("") +
      "</ul>"
    );
  }

  function renderOutlineNode(node) {
    const indent = "  ".repeat(node.level);
    const text = escapeHtml(node.text);
    let html =
      indent +
      '<li><a class="cf-outline-link" data-target="' + escapeHtml(node.id) + '" href="#' +
      escapeHtml(node.id) + '">' + text + "</a>";
    if (node.children && node.children.length > 0) {
      html +=
        "\n" +
        indent +
        '  <ul class="cf-outline-children">\n' +
        node.children.map(renderOutlineNode).join("\n") +
        "\n" +
        indent +
        "  </ul>";
    }
    html += "</li>";
    return html;
  }

  function setTitle(title) {
    const el = document.getElementById("cf-title");
    if (el) el.textContent = title || "Confluence Preview";
  }

  function setDirty(dirty) {
    const el = document.getElementById("cf-dirty");
    if (el) el.hidden = !dirty;
  }

  function setWarning(msg) {
    const el = document.getElementById("cf-warning");
    if (!el) return;
    if (msg) {
      el.textContent = "⚠ " + msg;
      el.hidden = false;
    } else {
      el.hidden = true;
    }
  }

  function highlightAll() {
    if (window.hljs && typeof window.hljs.highlightAll === "function") {
      try {
        window.hljs.highlightAll();
      } catch (e) {
        // Best-effort: ignore highlight failures for unsupported languages.
      }
    }
  }

  function bindOutlineClicks() {
    document.querySelectorAll(".cf-outline-link").forEach((el) => {
      el.addEventListener("click", (ev) => {
        ev.preventDefault();
        const target = el.getAttribute("data-target");
        if (!target) return;
        const heading = document.getElementById(target);
        if (heading) {
          heading.scrollIntoView({ behavior: "smooth", block: "start" });
          history.replaceState(null, "", "#" + target);
          setActiveOutline(target);
        } else {
          // Outline knows about a heading that the DOM doesn't yet (race
          // condition during fast refresh). Tell extension to navigate
          // in the source so the heading is visible.
          postMessage({ command: "navigate", target });
        }
      });
    });
  }

  function bindLinkClicks() {
    document.querySelectorAll("#cf-content a.cf-link").forEach((a) => {
      a.addEventListener("click", (ev) => {
        const href = a.getAttribute("href");
        if (!href || href === "#") {
          ev.preventDefault();
          return;
        }
        // Internal #anchor links: scroll within webview.
        if (href.startsWith("#")) {
          ev.preventDefault();
          const target = href.slice(1);
          const heading = document.getElementById(target);
          if (heading) heading.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }
        // External links: route through extension so we get a proper
        // external browser open (and CSP doesn't block them).
        ev.preventDefault();
        postMessage({ command: "openLink", href });
      });
    });
  }

  function setActiveOutline(id) {
    document.querySelectorAll(".cf-outline-link").forEach((el) => {
      if (el.getAttribute("data-target") === id) {
        el.classList.add("active");
        // Ensure visible
        const r = el.getBoundingClientRect();
        if (r.top < 0 || r.bottom > window.innerHeight) {
          el.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      } else {
        el.classList.remove("active");
      }
    });
  }

  function setupScrollSync() {
    const content = document.getElementById("cf-content");
    if (!content) return;
    let raf = null;
    content.addEventListener("scroll", () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const headings = content.querySelectorAll(".cf-heading[id]");
        if (headings.length === 0) return;
        // Find the heading currently closest to the top of the viewport.
        const threshold = content.getBoundingClientRect().top + 20;
        let active = headings[0];
        for (const h of headings) {
          if (h.getBoundingClientRect().top <= threshold) {
            active = h;
          } else {
            break;
          }
        }
        if (active) setActiveOutline(active.id);
      });
    });
  }

  function applyPayload(payload) {
    setTitle(payload.title);
    setDirty(payload.dirty);
    setWarning(payload.warnings && payload.warnings.length > 0
      ? payload.warnings.length + " warning(s): " + payload.warnings[0]
      : null);

    currentOutline = payload.outline || [];
    renderOutline(currentOutline);

    const content = document.getElementById("cf-content");
    if (content) {
      if (payload.html && payload.html.trim().length > 0) {
        content.innerHTML = payload.html;
        highlightAll();
        bindLinkClicks();
      } else {
        content.innerHTML = '<div class="cf-empty">Empty document</div>';
      }
    }

    bindOutlineClicks();

    // Honor URL hash if present.
    const hash = window.location.hash.slice(1);
    if (hash) {
      const heading = document.getElementById(hash);
      if (heading) heading.scrollIntoView({ behavior: "auto", block: "start" });
    } else if (currentOutline.length > 0) {
      setActiveOutline(currentOutline[0].id);
    }
  }

  // --- Message wiring ---

  window.addEventListener("message", (event) => {
    const msg = event.data;
    if (!msg || typeof msg !== "object") return;
    switch (msg.command) {
      case "render":
        applyPayload(msg.payload || {});
        break;
    }
  });

  // Sync theme class with VS Code.
  function syncTheme() {
    document.body.classList.remove("vscode-light", "vscode-dark", "vscode-high-contrast");
    document.body.classList.add(getThemeClass());
  }
  syncTheme();
  setupScrollSync();

  // Tell extension we're ready to receive content.
  postMessage({ command: "ready" });
})();