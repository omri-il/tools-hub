/* Shared Tools Hub renderer.
 * Turns a hub-config object (see go-shortener /api/hub-config) into the same
 * DOM the static hub used to hand-write, so css/style.css keeps working.
 * Used by both index.html (the live hub) and admin/ (the editor's live preview).
 */
(function (global) {
  "use strict";
  var CTA = "פתח את הכלי ←";

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function renderCard(card, showTags) {
    var a = el("a", "tool-card");
    a.setAttribute("href", card.href || "#");
    a.setAttribute("rel", "noopener");
    if (card.newTab) a.setAttribute("target", "_blank");
    if (card.id) a.setAttribute("data-tool", card.id);
    if (card.visibility === "admin") a.classList.add("admin-only");
    if (card.visibility === "hidden") a.classList.add("hidden-card");

    var icon = el("div", "tool-icon");
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = card.icon || "";
    a.appendChild(icon);

    a.appendChild(el("h2", "tool-title", card.title || ""));
    a.appendChild(el("p", "tool-desc", card.desc || ""));

    if (showTags && Array.isArray(card.tags) && card.tags.length) {
      var tags = el("span", "tool-tags");
      card.tags.forEach(function (t) { tags.appendChild(el("span", "tag", t)); });
      a.appendChild(tags);
    }
    a.appendChild(el("span", "tool-cta", CTA));
    return a;
  }

  /* Build a DocumentFragment of <section.cat-section> blocks.
   * options.includeHidden — render "hidden" cards too (admin editor preview).
   */
  function renderHub(cfg, options) {
    options = options || {};
    var includeHidden = !!options.includeHidden;
    var layout = (cfg && cfg.layout) || {};
    var showTags = layout.showTags !== false;
    var frag = document.createDocumentFragment();
    var categories = (cfg && cfg.categories) ? cfg.categories : [];

    // Favorites — a pinned section at the very top, pulled from every category.
    // Cards stay in their original category too; this is just a shortcut shelf.
    var favCards = [];
    categories.forEach(function (cat) {
      (cat.cards || []).forEach(function (c) {
        if (!c.favorite) return;
        if (!includeHidden && c.visibility === "hidden") return;
        favCards.push(c);
      });
    });
    if (favCards.length) {
      var favSec = el("section", "cat-section favorites-section");
      favSec.style.setProperty("--accent", "#fbbf24");
      favSec.style.setProperty("--accent-2", "#f59e0b");
      favSec.appendChild(el("h2", "cat", "⭐ מועדפים"));
      var favGrid = el("div", "tools-grid");
      favCards.forEach(function (c) { favGrid.appendChild(renderCard(c, showTags)); });
      favSec.appendChild(favGrid);
      frag.appendChild(favSec);
    }

    categories.forEach(function (cat) {
      var cards = (cat.cards || []).filter(function (c) {
        return includeHidden || c.visibility !== "hidden";
      });
      if (!cards.length) return;

      var sec = el("section", "cat-section");
      if (cat.adminOnly) sec.classList.add("admin-only");
      if (cat.accent) {
        sec.style.setProperty("--accent", cat.accent);
        sec.style.setProperty("--accent-2", cat.accent);
      }
      var h = el("h2", "cat");
      h.textContent = (cat.icon ? cat.icon + " " : "") + (cat.title || "");
      sec.appendChild(h);

      var grid = el("div", "tools-grid");
      cards.forEach(function (c) { grid.appendChild(renderCard(c, showTags)); });
      sec.appendChild(grid);
      frag.appendChild(sec);
    });
    return frag;
  }

  /* Apply density/card-size layout classes to a container element. */
  function applyLayout(container, cfg) {
    var layout = (cfg && cfg.layout) || {};
    container.classList.remove(
      "hub-density-comfortable", "hub-density-compact",
      "hub-size-small", "hub-size-medium", "hub-size-large");
    container.classList.add("hub-density-" + (layout.density || "comfortable"));
    container.classList.add("hub-size-" + (layout.cardSize || "medium"));
  }

  global.HubRender = { renderHub: renderHub, applyLayout: applyLayout };
})(window);
