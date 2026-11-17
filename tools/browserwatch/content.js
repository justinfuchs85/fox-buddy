// Lump for claude.ai: reads what Claude is doing in this tab and tells the extension's background worker.
//
// The same raw signals tools/appwatch reads from the desktop app (claude.ai is the same web app), so the
// bridge's rules (AppPages in tools/buddy_bridge.py) decide what they mean:
//   buttons  - labels of visible buttons that matter: "Stop response", "Allow once", "Deny", ...
//   statuses - text of the page's live status regions ("Claude is responding")
//   markers  - short texts that look like status words ("Asking a question")
// Only those short labels leave the page, and only to this Mac (127.0.0.1). Never message text.
(() => {
  const BUTTON = /\b(stop|allow|approve|deny|don.?t allow|reject|decline)\b/i;
  const MARKER = /\b(asking|question|awaiting|waiting|approv|allow|permission|working|running|thinking|responding|needs|input)/i;
  const tidy = (s, n = 80) => (s || '').replace(/\s+/g, ' ').trim().slice(0, n);
  const shown = el => el.getClientRects().length > 0;

  function read() {
    const buttons = new Set(), statuses = new Set(), markers = new Set();
    for (const b of document.querySelectorAll('button, [role="button"]')) {
      const l = tidy(b.getAttribute('aria-label') || b.textContent, 60);
      if (l && l.length <= 40 && BUTTON.test(l) && shown(b)) buttons.add(l);
    }
    for (const r of document.querySelectorAll('[role="status"], [aria-live="polite"], [aria-live="assertive"]')) {
      const t = tidy(r.textContent);
      if (t && t.length <= 60) statuses.add(t);
    }
    // short stand-alone texts with status words; capped so a long conversation stays cheap to scan
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n, seen = 0; (n = walk.nextNode()) && seen < 6000 && markers.size < 10; seen++) {
      const t = n.nodeValue;
      if (t.length > 40 || t.length < 4 || !MARKER.test(t)) continue;
      const el = n.parentElement;
      if (el && el.childElementCount === 0 && el.closest('button, nav, [contenteditable="true"]') === null && shown(el)) markers.add(tidy(t));
    }
    return {
      title: document.title || 'Claude',
      page: { buttons: [...buttons], statuses: [...statuses], markers: [...markers] },
      focused: document.visibilityState === 'visible' && document.hasFocus(),
    };
  }

  let last = '', lastSent = 0, lastRead = 0, trailing = 0;
  function send(msg) {
    try { chrome.runtime.sendMessage(msg).catch(() => {}); } catch (e) { stop(); }   // extension reloaded: this copy is orphaned
  }
  function check() {
    lastRead = Date.now();
    const r = read(), key = JSON.stringify(r);
    if (key !== last || lastRead - lastSent > 5000) { last = key; lastSent = lastRead; send(r); }   // on change, and a heartbeat
  }
  // Re-read when the page changes (at most a few times a second while Claude is streaming), on a
  // 2 s timer, and when you switch to or away from the tab. A tab in the background gets its timers
  // slowed down by Chrome, but page changes still come through, so a finished answer is noticed.
  const obs = new MutationObserver(() => {
    const now = Date.now();
    if (now - lastRead >= 700) check();
    else if (!trailing) trailing = setTimeout(() => { trailing = 0; check(); }, 700);
  });
  obs.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-label', 'disabled'], characterData: false });
  const timer = setInterval(check, 2000);
  const onFocus = () => check();
  addEventListener('visibilitychange', onFocus); addEventListener('focus', onFocus); addEventListener('blur', onFocus);
  addEventListener('pagehide', () => send({ gone: true }));
  function stop() { obs.disconnect(); clearInterval(timer); removeEventListener('visibilitychange', onFocus); }
  check();
})();
