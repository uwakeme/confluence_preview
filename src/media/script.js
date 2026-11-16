/* ============================================================
   Confluence Preview — webview renderer script.
   Receives parsed HTML from the extension and renders it,
   wires up outline navigation, scroll sync and code line numbers.
   ============================================================ */

(function () {
  const vscode = acquireVsCodeApi();
  let currentOutline = [];
  let currentUri = null;

  const persisted = vscode.getState() || {};
  let outlineHidden = !!persisted.outlineHidden;
  // Config-driven visibility applies once on open; afterwards the header
  // toggle wins and must survive refreshes.
  let visibilityInitialized = Object.prototype.hasOwnProperty.call(persisted, "outlineHidden");

  function postMessage(msg) {
    vscode.postMessage(msg);
  }

  function persistState() {
    vscode.setState({ uri: currentUri, outlineHidden });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  }

  // ---------- Outline ----------

  function renderOutline(outline) {
    const container = document.getElementById("cf-outline");
    if (!container) return;
    if (!outline || outline.length === 0) {
      container.innerHTML = '<div class="cf-outline-empty">No headings found</div>';
      return;
    }
    container.innerHTML =
      '<ul class="cf-outline-root">' +
      outline.map(renderOutlineNode).join("") +
      "</ul>";
    applyCollapsedState();
    bindOutlineToggles();
  }

  function renderOutlineNode(node) {
    const text = escapeHtml(node.text);
    const hasChildren = node.children && node.children.length > 0;
    const safeId = escapeHtml(node.id);
    const chevron = hasChildren
      ? '<span class="cf-outline-chevron" role="button" tabindex="-1" aria-label="Toggle" title="Click to collapse/expand"></span>'
      : '<span class="cf-outline-chevron cf-outline-chevron--leaf" aria-hidden="true"></span>';
    const row =
      '<div class="cf-outline-row">' +
      chevron +
      '<a class="cf-outline-link" data-level="' + node.level + '" data-target="' + safeId +
      '" href="#' + safeId + '" title="' + text + '">' + text + "</a>" +
      "</div>";
    let html =
      '<li class="cf-outline-item" data-level="' + node.level + '" data-id="' + safeId + '">' +
      row;
    if (hasChildren) {
      html +=
        '<ul class="cf-outline-children">' +
        node.children.map(renderOutlineNode).join("") +
        "</ul>";
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
      el.title = msg;
      el.hidden = false;
    } else {
      el.hidden = true;
    }
  }

  function applyOutlineVisibility() {
    const app = document.getElementById("app");
    if (app) app.classList.toggle("outline-hidden", outlineHidden);
    const btn = document.getElementById("cf-toggle-outline");
    if (btn) btn.textContent = outlineHidden ? "Show outline" : "Hide outline";
  }

  // ---------- Code highlighting & line numbers ----------

  function highlightAll() {
    if (window.hljs && typeof window.hljs.highlightAll === "function") {
      try {
        window.hljs.highlightAll();
      } catch (e) {
        // Best-effort: ignore highlight failures for unsupported languages.
      }
    }
    renderLineNumbers();
  }

  function renderLineNumbers() {
    document.querySelectorAll("#cf-content code[data-linenumbers='1']").forEach((code) => {
      const pre = code.closest("pre");
      if (!pre || pre.parentElement.classList.contains("cf-code-lined")) return;
      const first = parseInt(code.getAttribute("data-firstline") || "1", 10) || 1;
      const lineCount = code.textContent.split("\n").length;
      const nums = [];
      for (let i = 0; i < lineCount; i++) nums.push(first + i);
      const gutter = document.createElement("pre");
      gutter.className = "cf-code-gutter";
      gutter.setAttribute("aria-hidden", "true");
      gutter.textContent = nums.join("\n");
      const wrap = document.createElement("div");
      wrap.className = "cf-code-lined";
      pre.parentNode.insertBefore(wrap, pre);
      wrap.appendChild(gutter);
      wrap.appendChild(pre);
    });
  }

  // ---------- Outline interaction ----------

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
          postMessage({ command: "navigate", target });
        }
      });
    });
  }

  const COLLAPSED_STORAGE_KEY = "cf-outline-collapsed";

  function bindOutlineToggles() {
    document.querySelectorAll(".cf-outline-chevron").forEach((el) => {
      if (el.classList.contains("cf-outline-chevron--leaf")) return;
      el.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const item = el.closest(".cf-outline-item");
        if (!item) return;
        item.classList.toggle("collapsed");
        persistCollapsedState();
      });
    });
  }

  function persistCollapsedState() {
    const ids = Array.from(document.querySelectorAll(".cf-outline-item.collapsed"))
      .map((el) => el.getAttribute("data-id"))
      .filter(Boolean);
    try {
      localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify(ids));
    } catch (_) {
      // Ignore storage errors (e.g. when storage is disabled in this webview).
    }
  }

  function applyCollapsedState() {
    let saved;
    try {
      const raw = localStorage.getItem(COLLAPSED_STORAGE_KEY);
      saved = raw ? JSON.parse(raw) : [];
    } catch (_) {
      return;
    }
    if (!Array.isArray(saved) || saved.length === 0) return;
    const set = new Set(saved);
    document.querySelectorAll(".cf-outline-item").forEach((el) => {
      const id = el.getAttribute("data-id");
      if (id && set.has(id)) el.classList.add("collapsed");
    });
  }

  function bindLinkClicks() {
    document.querySelectorAll("#cf-content a.cf-link").forEach((a) => {
      a.addEventListener("click", (ev) => {
        const attachment = a.getAttribute("data-attachment");
        if (attachment) {
          ev.preventDefault();
          postMessage({ command: "openAttachment", filename: attachment });
          return;
        }
        const href = a.getAttribute("href");
        if (!href || href === "#") {
          ev.preventDefault();
          return;
        }
        if (href.startsWith("#")) {
          ev.preventDefault();
          const heading = document.getElementById(href.slice(1));
          if (heading) heading.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }
        ev.preventDefault();
        postMessage({ command: "openLink", href });
      });
    });
  }

  function bindHeadingDblClicks() {
    document.querySelectorAll("#cf-content .cf-heading[id]").forEach((h) => {
      h.addEventListener("dblclick", () => {
        postMessage({ command: "navigate", target: h.id });
      });
      h.title = "Double-click to reveal in source";
    });
  }

  function setActiveOutline(id, autoScroll) {
    document.querySelectorAll(".cf-outline-link").forEach((el) => {
      if (el.getAttribute("data-target") === id) {
        el.classList.add("active");
        if (autoScroll) scrollOutlineLinkIntoView(el);
      } else {
        el.classList.remove("active");
      }
    });
  }

  // Scroll only the outline pane (never ancestor containers), keeping the
  // link clear of the sticky pane header.
  function scrollOutlineLinkIntoView(el) {
    const pane = document.getElementById("cf-outline-pane");
    if (!pane) return;
    const header = pane.querySelector(".cf-outline-header");
    const pr = pane.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const headerH = header ? header.getBoundingClientRect().height : 0;
    if (r.top < pr.top + headerH) {
      pane.scrollTop -= pr.top + headerH - r.top;
    } else if (r.bottom > pr.bottom) {
      pane.scrollTop += r.bottom - pr.bottom;
    }
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
        const threshold = content.getBoundingClientRect().top + 20;
        let active = headings[0];
        for (const h of headings) {
          if (h.getBoundingClientRect().top <= threshold) {
            active = h;
          } else {
            break;
          }
        }
        if (active) setActiveOutline(active.id, true);
      });
    });
  }

  // ---------- Render payload ----------

  function applyPayload(payload) {
    setTitle(payload.title);
    setDirty(payload.dirty);
    setWarning(payload.warnings && payload.warnings.length > 0
      ? payload.warnings.length + " warning(s): " + payload.warnings[0]
      : null);

    currentUri = payload.uri || currentUri;
    if (!visibilityInitialized && typeof payload.outlineVisible === "boolean") {
      outlineHidden = !payload.outlineVisible;
      visibilityInitialized = true;
    }
    applyOutlineVisibility();
    persistState();

    currentOutline = payload.outline || [];
    renderOutline(currentOutline);

    const content = document.getElementById("cf-content");
    if (content) {
      // Preserve reading position and expanded sections across refreshes.
      const scrollTop = content.scrollTop;
      const openDetails = Array.from(content.querySelectorAll("details")).map((d) => d.open);

      if (payload.html && payload.html.trim().length > 0) {
        content.innerHTML = payload.html;
        highlightAll();
        bindLinkClicks();
        bindHeadingDblClicks();
      } else {
        content.innerHTML = '<div class="cf-empty">Empty document</div>';
      }

      content.querySelectorAll("details").forEach((d, i) => {
        if (i < openDetails.length) d.open = openDetails[i];
      });
      content.scrollTop = scrollTop;
    }

    bindOutlineClicks();

    const hash = window.location.hash.slice(1);
    if (hash) {
      const heading = document.getElementById(hash);
      if (heading) heading.scrollIntoView({ behavior: "auto", block: "start" });
    } else if (currentOutline.length > 0) {
      setActiveOutline(currentOutline[0].id);
    }
  }

  function scrollToHeading(id) {
    const heading = document.getElementById(id);
    if (!heading) return;
    heading.scrollIntoView({ behavior: "auto", block: "start" });
    setActiveOutline(id, true);
  }

  // ---------- Message wiring ----------

  window.addEventListener("message", (event) => {
    const msg = event.data;
    if (!msg || typeof msg !== "object") return;
    switch (msg.command) {
      case "render":
        applyPayload(msg.payload || {});
        break;
      case "syncScroll":
        if (msg.target) scrollToHeading(msg.target);
        break;
    }
  });

  // VS Code owns the body theme classes (vscode-light/dark/high-contrast)
  // and updates them live; the stylesheet keys off them directly.

  const toggleBtn = document.getElementById("cf-toggle-outline");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      outlineHidden = !outlineHidden;
      applyOutlineVisibility();
      persistState();
    });
  }

  applyOutlineVisibility();
  setupScrollSync();

  postMessage({ command: "ready" });
})();