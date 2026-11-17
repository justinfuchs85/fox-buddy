// Lump for claude.ai: collects every claude.ai tab's report and sends the whole picture to the
// Desk Buddy bridge (POST http://127.0.0.1:47823/browser), in the shape tools/appwatch sends for
// the desktop app. Each report replaces the last, so a tab that's gone simply isn't in it.
//
// The browser stops this worker when it's idle, so the tab list lives in storage.session
// (kept until the browser quits), not just in memory.
const api = globalThis.browser || chrome;        // Safari (and Firefox) have `browser`; Chrome has `chrome`
const BRIDGE = 'http://127.0.0.1:47823/browser';
// A tab that hasn't reported for this long (navigated away, crashed) is dropped. Generous, because
// Chrome slows the timers of tabs that have been in the background a while to about once a minute.
const STALE_MS = 150000;

let tabs = null;                 // tab id -> { title, page, focused, t }
const loaded = Promise.resolve(api.storage.session.get('tabs')).then(r => { tabs = new Map(Object.entries((r && r.tabs) || {})); },
                                                                 () => { tabs = new Map(); });
const save = () => { try { const p = api.storage.session.set({ tabs: Object.fromEntries(tabs) }); if (p && p.catch) p.catch(() => {}); } catch (e) {} };

function report() {
  const now = Date.now(), pages = {}, focused = [];
  for (const [id, r] of tabs) {
    if (now - r.t > STALE_MS) { tabs.delete(id); continue; }
    const p = pages[r.title] || (pages[r.title] = { buttons: [], statuses: [], markers: [] });
    for (const k of ['buttons', 'statuses', 'markers']) for (const v of r.page[k] || []) if (!p[k].includes(v)) p[k].push(v);
    if (r.focused) focused.push(r.title);
  }
  save();
  const body = JSON.stringify({ trusted: true, copies: [{ account: 'personal', pages, focused, sidebar: [], tabs: [], labels: [] }] });
  fetch(BRIDGE, { method: 'POST', body, headers: { 'Content-Type': 'application/json' } })
    .then(r => r.status === 200 ? r.json() : null)
    .then(j => { if (j && typeof j.focus === 'string') focus(j.focus); })
    .catch(() => {});                                                       // bridge not running: fine
}

// Desktop Lump's "Show me": bring the tab with this chat to the front, and its window with it.
function focus(name) {
  for (const [id, r] of tabs) {
    if (r.title !== name) continue;
    const tabId = Number(id);
    Promise.resolve(api.tabs.update(tabId, { active: true })).catch(() => {});
    if (r.windowId !== undefined) Promise.resolve(api.windows.update(r.windowId, { focused: true })).catch(() => {});
    return;
  }
}

api.runtime.onMessage.addListener((msg, sender) => {
  const id = sender.tab && sender.tab.id;
  if (id === undefined) return;
  loaded.then(() => {
    if (msg.gone) tabs.delete(String(id));
    else tabs.set(String(id), { title: msg.title, page: msg.page || {}, focused: !!msg.focused, windowId: sender.tab.windowId, t: Date.now() });
    report();
  });
});
api.tabs.onRemoved.addListener(id => loaded.then(() => { if (tabs.delete(String(id))) report(); }));

// Woken by tab reports; this sweep catches the last claude.ai tab going quiet without saying goodbye.
api.alarms.create('sweep', { periodInMinutes: 0.5 });      // (Safari may stretch this to a minute: fine)
api.alarms.onAlarm.addListener(a => { if (a.name === 'sweep') loaded.then(report); });
