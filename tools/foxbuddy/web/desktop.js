// Fox Buddy's player: runs the fox in a corner of the Mac's desktop.
//
// Loaded after the character (characters/fox: fox.js, rig.js, character.js, which set window.__character).
// One sequence at a time (a mood's loop, a transition, or an event), routing between moods through the
// drawn transitions, escalating alert -> waiting and working -> longhaul by itself, picking a tap gag, and
// going his own way (idle, asleep at night) when the bridge goes quiet.
//
// The bridge talks to it one line at a time:
//   s <mood>  e <event>  o <working> <waiting> <unseen>  c <rrggbb>  p <0|1>  h <secs>  k <token>  X  ?
//   t <clip>  (this clip is one of the tap reactions)   n <json>  (a line of narration for the bubble)
//   a <act>   (only this work act while he works, e.g. "a accountant"; "a -" for all three again)
// and hears back "tap", "gag <name>", "tapclip <name>", "resync" and "ok ..." lines.
//
// The app passes lines in with desk.line(text) and gets ours from the "fox" message handler.
(() => {
  const L = window.__character;   // the fox (characters/fox)
  const FPS = 24, ESCALATE_MS = 45000, LONGHAUL_MS = 10 * 60 * 1000, HOST_TIMEOUT_MS = 60000, OFFLINE_MARK_AFTER_MS = 8000;
  const NIGHT_FROM = 0, NIGHT_UNTIL = 8;
  const TANGERINE = [255, 122, 69];
  const rAF = window.__realRAF || window.requestAnimationFrame.bind(window);
  const t0 = performance.now(), millis = () => performance.now() - t0;

  // ---------- talking to the app ----------
  const said = [];
  function say(text) {
    said.push(text); if (said.length > 200) said.shift();
    try { window.webkit.messageHandlers.fox.postMessage({ say: text }); } catch (e) { /* headless test: read desk.said */ }
  }
  function tell(msg) { try { window.webkit.messageHandlers.fox.postMessage(msg); } catch (e) {} }

  // ---------- the sequences ----------
  const meta = L.meta();
  const MOODS = meta.moments.map(m => m.name);
  const BASE = Object.fromEntries(meta.moments.map(m => [m.name, MOODS[m.base]]));
  const expand = seq => { const out = []; for (const [id, n] of seq) for (let k = 0; k < n; k++) out.push(id); return out; };
  const cache = new Map();
  function seqOf(kind, key) {
    const ck = kind + ':' + key;
    if (!cache.has(ck)) {
      const raw = kind === 'loop' ? L.LOOPS[key] : kind === 'trans' ? L.TRANS[key] : kind === 'swap' ? L.SWAPS[key] : L.CLIPS[key].seq;
      cache.set(ck, expand(raw).filter(id => L.D[id]));
    }
    return cache.get(ck);
  }
  // One work act only (the accountant, for money questions: "a accountant", "a -" to stop), or null for the usual rotation.
  let act = null;
  const loopOf = m => {
    const v = `${m}.${act}`;
    return { kind: 'loop', key: act && L.LOOPS[v] ? v : m, from: m, to: m };
  };
  const transOf = (a, b) => L.TRANS[`${a}>${b}`] ? { kind: 'trans', key: `${a}>${b}`, from: a, to: b } : null;
  const eventIndex = n => {
    const c = L.CLIPS[n];
    return c && MOODS.includes(c.home) && c.seq && c.seq.length ? { kind: 'event', key: n, from: c.home, to: c.home } : null;
  };

  // ---------- player ----------
  let target = 'idle', curMood = 'idle', cur = loopOf('idle'), seqStart = 0, loopSince = 0, nextFidget = 0, pendingEvent = null;
  let prepMode = false, demo = false;
  const tapClips = new Set();
  function startSeq(s) { cur = s; seqStart = millis(); }
  function nextHop(a, b) {
    const direct = transOf(a, b); if (direct) return direct;
    if (BASE[a] !== a) return transOf(a, BASE[a]);
    if (BASE[b] !== b) { const t = transOf(a, BASE[b]); if (t) return t; }
    return null;
  }
  function settle(m) {
    curMood = m;
    if (target !== m) {
      const h = nextHop(m, target);
      if (h) return startSeq(h);
      curMood = m = target;                         // nothing drawn for this route: cut
    }
    if (pendingEvent && pendingEvent.from !== m) { // queued for a mood he never settled in: the same gag in this one
      const n = pendingEvent.key, u = n.lastIndexOf('_');
      pendingEvent = u > 0 ? (eventIndex(n.slice(0, u) + '_' + m) || eventIndex(n.slice(0, u) + '_' + BASE[m])) : null;
    }
    if (pendingEvent && pendingEvent.from === m) {
      const e = pendingEvent; pendingEvent = null;
      if (e.key.startsWith('tap_') && !L.silent) say('gag ' + e.key);     // (the bridge plays the gag's sound in time with it)
      else if (tapClips.has(e.key)) say('tapclip ' + e.key);
      return startSeq(e);
    }
    startSeq(loopOf(m)); loopSince = millis();
  }
  // Switch to (or back from) one act. Into it: from the start of the rotation, which IS that act, carry on
  // where he is; from anywhere else, a puff of smoke. Back out: he finishes the act's round, then frame()
  // picks the full rotation up where it starts, on the same drawing.
  function setAct(name) {
    act = name && (L.ACTS || []).includes(name) ? name : null;
    if (cur.kind !== 'loop') return;                       // takes effect when he next settles
    const want = loopOf(curMood);
    if (!act || want.key === cur.key) return;
    const full = seqOf('loop', cur.key), part = seqOf('loop', want.key);
    const pos = Math.floor(Math.max(0, millis() - seqStart) * FPS / 1000) % Math.max(1, full.length);
    if (cur.key === curMood && pos < part.length - 16) { cur = want; seqStart = millis() - pos * 1000 / FPS; lastKey = ''; }   // same drawing, same place
    else if (L.SWAPS && L.SWAPS[want.key]) startSeq({ kind: 'swap', key: want.key, from: curMood, to: curMood });
    else startSeq(want);
  }
  // Calm (the app's default; desk.setCalm(false) for Lively): once he's up to something (typing, celebrating...) he
  // keeps at it at least DWELL_MS, so a flurry of quick changes (Claude starting and stopping) plays as one. Getting
  // going from rest is immediate, and anything that needs you goes straight through.
  let calm = true, targetAt = 0, queued = null, queueTimer = 0;
  const DWELL_MS = 10000, URGENT = new Set(['alert', 'waiting', 'meeting', 'letter', 'flag']), REST = new Set(['idle', 'awake', 'night']);
  function setTarget(m) {
    const since = millis() - targetAt;
    if (calm && m !== target && !URGENT.has(m) && !REST.has(target) && since < DWELL_MS) {
      queued = m; clearTimeout(queueTimer);
      queueTimer = setTimeout(() => { const q = queued; queued = null; if (q && q !== target) setTarget(q); }, DWELL_MS - since + 20);
      return;
    }
    queued = null; clearTimeout(queueTimer);
    if (m !== target) targetAt = millis();
    target = m; if (cur.kind === 'loop') settle(curMood);
  }
  // You at the Mac (the app says so: desk.present): no deep night sleep while you're using it, he's just idle.
  // asked: what the bridge (or his own offline mode) wants; shown: what he actually plays.
  let present = false, asked = 'idle', wakeUntil = 0;
  const WAKE_MS = 90 * 1000;                        // after you wake him, he stays up this long (more while you're around)
  let holdMood = null, holdUntil = 0;              // the app showing something for a while (an email alert: the letter)
  const shown = m => ((m === 'idle' || m === 'night' || m === 'awake') && holdMood && millis() < holdUntil ? holdMood
    : (m === 'idle' || m === 'night') && millis() < wakeUntil ? 'awake' : m === 'night' && present ? 'idle' : m);
  function want(m) {
    asked = m;
    const s = shown(m);
    if (s === target) { queued = null; clearTimeout(queueTimer); } else setTarget(s);     // back where he is: drop a queued change
  }
  function setPresent(on) { present = !!on; if (asked === 'night') want('night'); }

  const GAGS = L.GAGS || [];
  let lastGag = -1, lastTapClip = '';
  function pickTap() {
    const pool = GAGS.map((g, i) => i).filter(i => i !== lastGag);
    lastGag = pool[Math.floor(Math.random() * pool.length)];
    return GAGS[lastGag];
  }
  function pickTapClip() {                          // now and then one of the tap reactions the bridge gave him
    const ids = [...tapClips].filter(n => n !== lastTapClip && eventIndex(n));
    if (!ids.length || Math.floor(Math.random() * (11 + ids.length)) < 11) return '';
    return (lastTapClip = ids[Math.floor(Math.random() * ids.length)]);
  }
  function playEvent(n) {
    if (n === 'tap') {
      if (target === 'night') n = 'tap_startle';
      else if (prepMode || target === 'meeting') n = 'tap_prep';
      else { n = pickTapClip(); if (!n) n = 'tap_' + pickTap(); }
    }
    const e = eventIndex(n) || eventIndex(n + '_' + target) || eventIndex(n + '_' + BASE[target]);
    if (!e) return false;
    pendingEvent = e;
    if (target !== e.from) setTarget(e.from); else if (cur.kind === 'loop') settle(curMood);
    return true;
  }

  // ---------- on his own ----------
  let lastHost = -1e9, hostSeen = false, offline = true, clockBase = -1, clockAt = 0;
  let ovWorking = 0, ovWaiting = 0, ovUnseen = 0;
  const hostAlive = now => hostSeen && now - lastHost < HOST_TIMEOUT_MS;
  const nightHour = h => NIGHT_FROM < NIGHT_UNTIL ? h >= NIGHT_FROM && h < NIGHT_UNTIL : h >= NIGHT_FROM || h < NIGHT_UNTIL;
  const nightNow = () => nightHour(new Date().getHours());       // the Mac knows the time: no need for the bridge's clock
  function heardFromHost() {
    const was = offline;
    lastHost = millis(); hostSeen = true; offline = false;
    if (was) say('resync');
  }
  function autoBehaviour(now) {
    if (demo || cur.kind !== 'loop' || target !== curMood) return;
    if (curMood === 'idle' && !pendingEvent && !hostAlive(now)) {
      if (!nextFidget) nextFidget = now + (calm ? 240000 + Math.random() * 120000 : 40000 + Math.random() * 50000);
      if (now > nextFidget) { nextFidget = 0; playEvent(['fidget_toss', 'fidget_twitch', 'fidget_bubble'][Math.floor(Math.random() * 3)]); }
    } else nextFidget = 0;
    if (curMood === 'alert' && now - loopSince > ESCALATE_MS) setTarget('waiting');
    if (curMood === 'working' && now - loopSince > LONGHAUL_MS) setTarget('longhaul');
  }
  function runOffline(now) {
    if (!offline && !hostAlive(now)) {
      offline = true; ovWorking = ovWaiting = ovUnseen = 0; prepMode = false; goal = [...TANGERINE];
    }
    if (!offline || demo) return;
    const own = nightNow() ? 'night' : 'idle';
    if (shown(own) !== target && !pendingEvent && cur.kind === 'loop') want(own);
  }
  const offlineMark = now => offline && !demo && now > OFFLINE_MARK_AFTER_MS;

  const DEMO = [['s', 'idle', 6000], ['e', 'fidget_bubble', 6500], ['e', 'fidget_twitch', 3500], ['s', 'working', 6000], ['e', 'oops', 7000],
    ['e', 'tap', 5000], ['s', 'longhaul', 6500], ['s', 'alert', 6000], ['s', 'waiting', 9000], ['s', 'done', 5000], ['e', 'tap', 4500],
    ['s', 'idle', 4000], ['e', 'fidget_toss', 5500], ['e', 'hello', 7000], ['s', 'night', 9000], ['s', 'idle', 3000]];
  let demoStep = -1, demoNext = 0;
  function runDemo(now) {
    if (!demo || now < demoNext) return;
    demoStep = (demoStep + 1) % DEMO.length;
    const [type, name, ms] = DEMO[demoStep];
    if (type === 's') setTarget(name); else playEvent(name);
    demoNext = now + ms;
  }

  // ---------- commands ----------
  const reply = () => say(`ok mode=${demo ? 'demo' : offline ? 'offline' : 'direct'} target=${target} playing=${cur.key}(${cur.kind})`);
  function line(ln) {
    ln = String(ln).trim(); if (!ln) return;
    const cmd = ln[0], arg = ln.slice(1).trim().toLowerCase();
    if (cmd === 'k') { say('ok paired'); heardFromHost(); return; }      // nothing to pair: the app only listens on this Mac
    if (cmd === 'w' || cmd === 'W') { say('err no wi-fi on the desktop'); return; }
    heardFromHost();
    if (cmd === 'h') { const s = parseInt(arg, 10); if (s >= 0 && s < 86400) { clockBase = s; clockAt = millis(); } return; }
    if (cmd === 's') {
      if (arg === 'demo' || arg === 'cycle') { demo = true; demoNext = 0; return reply(); }
      if (!MOODS.includes(arg)) { say('err unknown mood'); return; }
      const selfEscalated = target === 'waiting' || target === 'longhaul';
      const same = !demo && (shown(arg) === target || (selfEscalated && BASE[target] === arg));
      demo = false;
      asked = arg;
      if (!same) setTarget(shown(arg));
      return reply();
    }
    if (cmd === 'e') { demo = false; if (!playEvent(arg)) { say('err unknown event'); return; } return reply(); }
    if (cmd === 'o') {
      const [w, a, u] = arg.split(/\s+/).map(v => parseInt(v, 10) || 0);
      ovWorking = Math.max(0, w || 0); ovWaiting = Math.max(0, a || 0); ovUnseen = Math.max(0, u || 0);
      say(`ok overlay working=${ovWorking} waiting=${ovWaiting} unseen=${ovUnseen}`); return;
    }
    if (cmd === 'c') {
      const hex = arg.replace(/^#/, '');
      if (!/^[0-9a-f]{6}$/.test(hex)) { say('err bad colour'); return; }
      goal = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16)); say('ok colour ' + hex.toUpperCase()); return;
    }
    if (cmd === 'X') { tap(); return; }
    if (cmd === 'p') { prepMode = parseInt(arg, 10) !== 0; say(`ok prep=${prepMode ? 1 : 0}`); return; }
    if (cmd === 'a') { setAct(arg === '-' ? null : arg); say('ok act ' + (act || '-')); return; }
    if (cmd === 't') { if (eventIndex(arg)) tapClips.add(arg); say('ok tapclip ' + arg); return; }
    if (cmd === 'i') { say('ok imu=desktop'); return; }
    if (cmd === 'T') { say('ok threshold=click'); return; }
    if (cmd === '?') return reply();
    say('err unknown command');
  }
  function tap() { if (wake()) return; say('tap'); playEvent('tap'); }   // the bridge decides what a tap means for Claude
  // You came over while he's asleep (a click, or the mouse resting on him): he wakes up, yawns, rubs his eyes
  // and waves, then stays awake a while. Already awake from that: you being there keeps him up a bit longer.
  function wake() {
    const now = millis();
    if (now < wakeUntil) { wakeUntil = now + WAKE_MS; return false; }
    const asleep = cur.kind === 'loop' && (curMood === 'idle' || curMood === 'night') && target === curMood && !act;
    if (!asleep || !(L.CLIPS || {})['wake_' + curMood]) return false;
    present = true; wakeUntil = now + WAKE_MS;
    const from = curMood;
    target = 'awake'; pendingEvent = null;
    startSeq({ kind: 'event', key: 'wake_' + from, from, to: 'awake' });
    return true;
  }
  function wakeCheck(now) {
    if (wakeUntil && now >= wakeUntil) { wakeUntil = 0; want(asked); }
    if (holdMood && now >= holdUntil) { holdMood = null; want(asked); }
  }
  function hold(mood, ms) {
    if (!L.LOOPS[mood]) return;
    holdMood = mood; holdUntil = millis() + Math.min(+ms || 60000, 10 * 60000); present = true; want(asked);
  }
  // You're typing in his bubble: he watches you do it, looking toward the bubble (gx, gy: about -1..1,
  // up negative). Asleep, he wakes up first. It eases in, and back out a moment after you stop.
  const WATCH_MS = 2500;
  let watchAt = -1e9, gaze = [0, -1], gazeAmt = 0;
  function watch(gx, gy) {
    const now = millis();
    gaze = [Math.max(-1, Math.min(1, +gx || 0)), Math.max(-1, Math.min(1, +gy || -1))];
    watchAt = now;
    if (!wake()) wakeUntil = Math.max(wakeUntil, now + WAKE_MS);     // (already up: stays up while you type)
    if (curMood === 'idle' && cur.kind === 'loop' && target === 'idle') want(asked);  // dozing in idle: wake() handled it
  }
  // Awake with nothing to do, his eyes follow your pointer around the screen (the app sends where it is,
  // gx, gy about -1..1 from his head, a few times a second while it moves). It never wakes him or keeps
  // him up; a few seconds after the pointer stops, he goes back to looking around on his own.
  const FOLLOW_MS = 4000;
  let followAt = -1e9, followTo = [0, 0];
  function follow(gx, gy) {
    followTo = [Math.max(-1, Math.min(1, +gx || 0)), Math.max(-1, Math.min(1, +gy || 0))];
    followAt = millis();
  }
  let gazeDir = [0, -1];                // where he's actually looking: eases toward the target, so a
                                        // pointer update a few times a second still reads as a smooth glance
  function gazeNow(now) {
    const typing = now - watchAt < WATCH_MS && cur.kind === 'loop' && curMood !== 'night';
    const following = !typing && now - followAt < FOLLOW_MS && cur.kind === 'loop' && curMood === 'awake' && !holdMood;
    const on = typing || following ? 1 : 0, to = typing ? gaze : followTo;
    if (on) gazeDir = gazeDir.map((v, i) => v + (to[i] - v) * 0.25);
    gazeAmt += (on - gazeAmt) * (on ? 0.22 : 0.1);
    if (Math.abs(on - gazeAmt) < 0.01) gazeAmt = on;
    return gazeAmt > 0.01 ? [gazeDir[0], gazeDir[1], gazeAmt] : null;
  }

  // ---------- drawing ----------
  let look = 'float';                 // float: no background, light line, a dark halo so he reads on any wallpaper
                                      // ink: no background, dark line (like a cartoon on paper)
                                      // glass: on his own dark rounded tile
  let tintNow = [...TANGERINE], goal = [...TANGERINE], facing = 1;
  const hex = rgb => '#' + rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  const canvas = document.createElement('canvas');
  canvas.id = 'desk';
  document.body.appendChild(canvas);
  const raw = canvas.getContext('2d');
  let k = 1, lastKey = '';            // backing pixels per 240-unit; what's on screen now
  function resize() {
    const dpr = window.devicePixelRatio || 1, side = Math.min(window.innerWidth, window.innerHeight);
    canvas.style.width = canvas.style.height = side + 'px';
    canvas.width = canvas.height = Math.max(1, Math.round(side * dpr));
    k = canvas.width / 240; lastKey = '';
  }
  window.addEventListener('resize', resize); resize();

  // render() assumes a 240 x 240 canvas: scale every transform it sets, and (unless he's behind glass)
  // drop the black background it paints first and darken the floor shadow it draws next.
  let bgSkipped = false, fills = 0;
  const ctx = new Proxy(raw, {
    get(t, p) {
      if (p === 'setTransform') return (a, b, c, d, e, f) => typeof a === 'number' ? t.setTransform(a * k, b * k, c * k, d * k, e * k, f * k) : t.setTransform(a);
      if (p === 'resetTransform') return () => t.setTransform(k, 0, 0, k, 0, 0);
      if (p === 'fillRect') return (x, y, w, h) => {
        if (look !== 'glass' && !bgSkipped && x === 0 && y === 0 && w === 240 && h === 240) { bgSkipped = true; return; }
        t.fillRect(x, y, w, h);
      };
      if (p === 'fill') return (...a) => {
        if (look !== 'glass' && fills++ === 0) { const keep = t.fillStyle; t.fillStyle = 'rgba(0,0,0,.22)'; t.fill(...a); t.fillStyle = keep; return; }
        t.fill(...a);
      };
      const v = t[p]; return typeof v === 'function' ? v.bind(t) : v;
    },
    set(t, p, v) { t[p] = v; return true; }
  });

  function drawOfflineMark(now) {
    const t = now / 1000, a = 0.45 + 0.3 * Math.sin(t * 2.1), px = 200 + 2.5 + 2.5 * Math.sin(t * 1.3);
    ctx.fillStyle = `rgba(255,241,220,${a})`;
    ctx.fillRect(186, 226, px - 186, 2);
    ctx.beginPath(); ctx.roundRect(px, 221, 9, 12, 2); ctx.fill();
    ctx.fillRect(px + 9, 223, 4, 2); ctx.fillRect(px + 9, 229, 4, 2);
    ctx.beginPath(); ctx.roundRect(220, 219, 4, 16, 1); ctx.fill();
  }
  function drawOverlay(now) {
    if (offlineMark(now)) drawOfflineMark(now);
    const m = target, workingMood = m === 'working' || m === 'longhaul', alertMood = m === 'alert' || m === 'waiting', t = now / 1000;
    if (ovWorking > 0 && !workingMood) for (let i = 0; i < 3; i++) {
      const b = Math.max(0, Math.sin(t * 6 - i * 0.9)), s = 0.45 + 0.55 * b;
      ctx.fillStyle = `rgb(${255 * s},${241 * s},${220 * s})`; ctx.beginPath(); ctx.arc(16 + i * 10, 226 - b * 4, 2.5, 0, Math.PI * 2); ctx.fill();
    }
    if (ovWaiting >= 2 || (ovWaiting >= 1 && !alertMood)) {
      const p = 0.6 + 0.4 * Math.sin(t * 5); ctx.fillStyle = `rgb(${255 * p},${181 * p},${71 * p})`;
      for (let i = 0; i < Math.min(ovWaiting, 5); i++) { ctx.beginPath(); ctx.arc(14 + i * 11, 14, 3.5, 0, Math.PI * 2); ctx.fill(); }
    }
    if (ovUnseen > 0 && m !== 'done') for (let j = 0; j < Math.min(ovUnseen, 2); j++) {
      const s = (j ? 4 : 6) * (0.75 + 0.25 * Math.sin(t * 4 + j * 2)), x = 224 - j * 13, y = 16 + j * 6;
      ctx.fillStyle = 'rgb(200,255,210)'; ctx.beginPath();     // a four-pointed twinkle, as the board draws it
      ctx.moveTo(x, y - s); ctx.lineTo(x + s * 0.3, y - s * 0.3); ctx.lineTo(x + s, y); ctx.lineTo(x + s * 0.3, y + s * 0.3);
      ctx.lineTo(x, y + s); ctx.lineTo(x - s * 0.3, y + s * 0.3); ctx.lineTo(x - s, y); ctx.lineTo(x - s * 0.3, y - s * 0.3);
      ctx.closePath(); ctx.fill();
    }
  }

  let lastFade = 0, dimNow = 1;
  function frame() {
    rAF(frame);
    const now = millis();
    runDemo(now); runOffline(now); autoBehaviour(now); wakeCheck(now);
    let frames = seqOf(cur.kind, cur.key);
    let tick = Math.floor(Math.max(0, now - seqStart) * FPS / 1000);
    if (cur.kind !== 'loop' && tick >= frames.length) { settle(cur.to); tick = 0; frames = seqOf(cur.kind, cur.key); }
    if (cur.kind === 'loop' && tick >= frames.length && loopOf(curMood).key !== cur.key) {   // an act ended its round: back to the rotation
      startSeq(loopOf(curMood)); tick = 0; frames = seqOf(cur.kind, cur.key);
    }
    if (!frames.length) { settle(target); return; }
    const pos = cur.kind === 'loop' ? tick % frames.length : Math.min(tick, frames.length - 1), id = frames[pos];
    if (now - lastFade >= 30 && Math.abs(goal[0] - tintNow[0]) + Math.abs(goal[1] - tintNow[1]) + Math.abs(goal[2] - tintNow[2]) > 1.5) {
      lastFade = now; tintNow = tintNow.map((v, i) => v + (goal[i] - v) * 0.12);
    }
    const night = cur.kind === 'loop' && curMood === 'night';
    dimNow += ((night ? 0.55 : 1) - dimNow) * 0.04;
    canvas.style.opacity = dimNow.toFixed(3);
    const ov = offlineMark(now) || ovWorking || ovWaiting || ovUnseen;
    const g = gazeNow(now);
    const key = `${cur.key}|${tick}|${hex(tintNow)}|${look}|${ov ? Math.floor(now / 100) : ''}|${g ? g.map(v => v.toFixed(2)).join(',') : ''}`;
    if (key === lastKey) return;
    lastKey = key;
    L.setTint(hex(tintNow)); L.setLine(look === 'ink' ? 'paper' : 'glow');
    raw.setTransform(1, 0, 0, 1, 0, 0); raw.clearRect(0, 0, canvas.width, canvas.height);
    bgSkipped = false; fills = 0;
    raw.save();
    if (look === 'glass') { raw.beginPath(); raw.roundRect(0, 0, canvas.width, canvas.height, canvas.width * 0.09); raw.clip(); }
    try {
      if (cur.kind === 'loop') L.render(ctx, cur.from, id, tick, { dim: false, gaze: g });
      else L.render(ctx, L.fxFor(id), id, tick, { dim: false });
    } catch (e) { console.error('render', cur.key, id, e); }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (ov) drawOverlay(now);
    raw.restore();
  }

  function setLook(v) {
    look = ['float', 'ink', 'glass'].includes(v) ? v : 'float';
    document.documentElement.dataset.look = look; lastKey = '';
  }
  setLook('float');

  // Is there any of him (or his props) near this point? (x, y in CSS pixels from the window's top left.)
  // The app asks while the pointer is over the window, so clicks on the empty space around him go through.
  function hit(x, y) {
    if (look === 'glass') return true;
    const r = canvas.getBoundingClientRect(), dpr = canvas.width / r.width, pad = Math.round(6 * dpr);
    let px = Math.round((x - r.left) * dpr), py = Math.round((y - r.top) * dpr);
    if (facing < 0) px = canvas.width - px;            // the drawing is mirrored on screen, not in its pixels
    if (px < -pad || py < -pad || px > canvas.width + pad || py > canvas.height + pad) return false;
    const x0 = Math.max(0, px - pad), y0 = Math.max(0, py - pad), w = Math.min(canvas.width, px + pad) - x0, h = Math.min(canvas.height, py + pad) - y0;
    if (w <= 0 || h <= 0) return false;
    const d = raw.getImageData(x0, y0, w, h).data;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 24) return true;
    return false;
  }

  window.desk = {
    line, tap, wake, watch, follow, hold, setLook, said, hit, act: setAct, present: setPresent,
    play: n => playEvent(String(n)),
    face: d => { facing = d < 0 ? -1 : 1; canvas.style.transform = facing < 0 ? 'translateX(-50%) scaleX(-1)' : ''; },   // which way he's walking (keeps start.js's centring)
    setCalm: on => { calm = !!on; if (!calm) { queued = null; clearTimeout(queueTimer); } },
    unhold: m => { if (holdMood === m) { holdUntil = 0; want(asked); } },   // end a hold, if it's still that one (music stopped)          // one of his clips by name (stretch: the version for whatever mood he's in)
    clips: () => Object.keys(L.CLIPS).filter(n => !n.startsWith('tap_') && eventIndex(n)).sort(),
    state: () => ({ target, curMood, playing: cur.key, kind: cur.kind, act, offline, prepMode, overlay: [ovWorking, ovWaiting, ovUnseen], tint: hex(tintNow) }),
    // for tests: jump the clock forward
    _skip: ms => { seqStart -= ms; loopSince -= ms; lastHost -= ms; },
  };
  settle('idle');
  rAF(frame);
  tell({ ready: true, clips: window.desk.clips(), gags: GAGS, character: L.name || 'fox' });
})();
