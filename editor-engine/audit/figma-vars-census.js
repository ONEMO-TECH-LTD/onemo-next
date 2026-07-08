// Variables-editor UI census (KAI-9399) — the ONE extractor run in BOTH the live Figma variables
// modal AND our /react-figma Variables page, so the variables UI is CLONED from the source of truth,
// never hand-built. Dan's standing mandate: use the deterministic tool to read Figma's UI+behaviour
// and repeat it. Structural fingerprint (framework-agnostic: text anchors + geometry + cursor styles).
//
// Usage (paste in either tab's console, or inject via the browser bridge):
//   copy(JSON.stringify(figmaVarsCensus()))
(function () {
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
  const txt = (e) => (e.textContent || '').trim();
  const cur = (e) => getComputedStyle(e).cursor;
  function findLabel(label, minLeft) {
    return [...document.querySelectorAll('div,span,button')].find((e) =>
      txt(e) === label && e.clientHeight > 0 && e.clientHeight < 48 && vis(e) &&
      (minLeft == null || e.getBoundingClientRect().left >= minLeft));
  }
  function census() {
    const out = { href: location.host, at: new Date().toISOString().slice(0, 19) };
    const colHdr = findLabel('Collections');
    const grpHdr = findLabel('Groups');
    out.sidebar = { hasCollections: !!colHdr, hasGroups: !!grpHdr, width: null, dividerDraggable: false, collectionsPaneScrolls: false, groupsPaneScrolls: false };
    if (colHdr) {
      let sb = colHdr;
      for (let k = 0; k < 8 && sb; k++) { const r = sb.getBoundingClientRect(); if (r.width >= 180 && r.width <= 360) { out.sidebar.width = Math.round(r.width); break; } sb = sb.parentElement; }
    }
    // draggable divider between the Collections list and the Groups list
    if (colHdr && grpHdr) {
      const cB = colHdr.getBoundingClientRect().bottom, gT = grpHdr.getBoundingClientRect().top;
      out.sidebar.dividerDraggable = [...document.querySelectorAll('*')].some((e) => {
        const r = e.getBoundingClientRect();
        return r.top > cB - 8 && r.bottom < gT + 12 && r.width > 60 && r.height < 16 && (/row-resize|ns-resize/.test(cur(e)) || e.getAttribute('role') === 'separator');
      });
      // are the two lists independently scrollable panes?
      const scrolls = (hdr) => { let n = hdr; for (let k = 0; k < 6 && n; k++) { const s = getComputedStyle(n); if (/(auto|scroll)/.test(s.overflowY) && n.scrollHeight > n.clientHeight + 2) return true; n = n.parentElement; } return false; };
      out.sidebar.collectionsPaneScrolls = scrolls(colHdr);
      out.sidebar.groupsPaneScrolls = scrolls(grpHdr);
    }
    // table columns: the header row containing Name/Variable
    const nameHdr = findLabel('Name', 180) || findLabel('Variable', 180);
    if (nameHdr) {
      let hrow = nameHdr;
      for (let k = 0; k < 6 && hrow; k++) { if (hrow.getBoundingClientRect().width > 400) break; hrow = hrow.parentElement; }
      out.columns = [...hrow.children].filter(vis).map((c) => ({ label: txt(c).replace(/\s+/g, ' ').slice(0, 24), w: Math.round(c.getBoundingClientRect().width) }));
      const hy = nameHdr.getBoundingClientRect().top;
      out.columnResizeHandles = [...document.querySelectorAll('*')].filter((e) => { const r = e.getBoundingClientRect(); return /col-resize|ew-resize/.test(cur(e)) && Math.abs(r.top - hy) < 220 && r.left > 180; }).length;
      // equal-distribution check: are the visible data columns within ~15% of each other?
      const ws = out.columns.map((c) => c.w).filter((w) => w > 40);
      out.columnsEqualish = ws.length > 1 && (Math.max(...ws) - Math.min(...ws)) / Math.max(...ws) < 0.15;
    }
    // collapse / hide-panel control
    const hide = [...document.querySelectorAll('button,[role="button"]')].find((e) => /hide panel|collapse|toggle panel/i.test(e.getAttribute('aria-label') || e.getAttribute('title') || ''));
    out.collapseControl = hide ? (hide.getAttribute('aria-label') || hide.getAttribute('title')) : null;
    return out;
  }
  window.figmaVarsCensus = census;
})();
