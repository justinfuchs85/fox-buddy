// The fox as a Desktop Lump character: his moods, the moves between them, his fidgets and his gags.
//
// Everything is a pose for the rig (rig.js). A sequence is a list of [drawing, ticks] at 24 ticks a second,
// the same shape the desk Lump uses, so web/desktop.js plays him exactly the way it plays Lump, and the
// bridge drives him with the same moods and events.
(() => {
  const F = window.__foxDraw, R = window.__foxRig;
  const { CREAM, INK, DARK, stroke, dot, trace, wob, part, oval } = F;

  const MOMENTS = ['idle', 'working', 'alert', 'done', 'waiting', 'longhaul', 'night', 'meeting', 'awake', 'letter'];
  const BASE = { idle: 'idle', working: 'working', alert: 'alert', done: 'done', waiting: 'alert', longhaul: 'working', night: 'idle', meeting: 'meeting', awake: 'awake', letter: 'letter' };
  const GAGS = ['pounce', 'tailchase', 'sneeze', 'howl', 'zoomies', 'hiccup', 'leaf', 'boop', 'yawn', 'peekaboo', 'disco', 'floss', 'dab', 'dubstep'];

  const D = {}, LOOPS = {}, TRANS = {}, CLIPS = {};
  let uid = 0;
  const add = (name, pose) => { const id = name + '_' + (uid++); D[id] = pose; return id; };
  const P0 = { build: 'chibi' };
  // what blends smoothly between poses, and where a tucked-away paw is (to blend a paw in or out from)
  const NUM = ['x', 'y', 'squash', 'lean', 'tilt', 'hx', 'hy', 'earL', 'earR', 'perk', 'tail', 'curl', 'tailK'];
  const TUCK = { L: [114, 186], R: [142, 186] };

  const mix = (...ps) => Object.assign({}, P0, ...ps);
  const wave = (i, n, a = 1) => Math.sin(i / n * Math.PI * 2) * a;

  // ---------- the moods: what each looks like, as loops ----------
  // Each returns [pose, ticks] pairs; the first pose is the one transitions start and end on.
  const SLEEP = { eyes: 'closed', mouth: 'none', earL: 0.3, earR: 0.3, tail: 0.06, hy: 4, tilt: 0.06, fx: 'idle' };
  const AWAKE = { eyes: 'dot', mouth: 'w', fx: 'none' };
  const WORK = { eyes: 'look', look: [0, 3.5], mouth: 'flat', perk: 1.04, prop: 'adder', hat: 'visor', fx: 'none', hy: 2 };
  // ---------- working: three acts in rotation (accountant, typewriter, mad scientist) ----------
  // Each act is keyframes [pose, ticks] on top of a seated working pose. In the long haul he's frazzled
  // and the mess piles up: tape on the floor, a heap of paper balls, singed fur, a stack of coffee cups.
  const WB = { eyes: 'look', look: [0, 3], mouth: 'flat', perk: 1.04, hy: 2, fx: 'none' };
  function worker(tired, extra) {
    return list => list.map(([t, p]) => {
      const q = Object.assign({}, WB, extra, p);
      if (tired) {
        if (q.eyes === 'look' || q.eyes === 'dot') q.eyes = 'squint';
        if (q.mouth === 'flat' || q.mouth === 'w') q.mouth = 'wobble';
        Object.assign(q, { earL: Math.max(q.earL || 0, 0.38), earR: Math.max(q.earR || 0, 0.32), squash: (q.squash || 0) + 0.04, cups: 3 });
        if (!q.fx || q.fx === 'none') q.fx = 'sweat';
      }
      return [mix(q), t];
    });
  }
  function accountant(tired) {
    const W = worker(tired, { prop: 'adder', hat: 'visor', tilthat: tired ? 0.16 : 0, pileTape: tired ? 1 : 0 });
    const out = []; let tape = 0.15;
    const punch = n => { for (let k = 0; k < n; k++) { const l = k % 2 === 0; out.push(...W([[4, { tape, armL: [112, l ? 178 : 168], armR: [146, l ? 168 : 178], hy: 2 + (k % 2) }]])); } };
    const crank = () => {
      out.push(...W([[6, { tape, armR: [180, 170], armL: [112, 172], crank: 0 }], [4, { tape: tape + 0.2, armR: [176, 190], armL: [112, 172], crank: 1, fx: 'chunk' }],
                     [6, { tape: tape + 0.2, armR: [178, 180], armL: [112, 172], crank: 0.3 }]]));
      tape += 0.2;
    };
    for (let r = 0; r < 3; r++) {
      punch(12); crank();
      out.push(...W([[22, { tape, look: [-1, -3], tilt: -0.05, mouth: 'w' }]]));
      punch(8); crank();
    }
    out.push(...W([[8, { tape, armR: [104, 120], look: [-2, -2] }], [3, { tape: 0.12, armR: [148, 142], strip: true, fx: 'rip' }],
      [30, { tape: 0.12, strip: true, armR: [150, 144], armL: [106, 146], eyes: 'squint', brows: 'up', look: [0, -1], hy: 0 }],
      [8, { tape: 0.12, strip: true, armR: [150, 144], armL: [106, 146], mouth: 'smile', hy: 4 }], [8, { tape: 0.12, strip: true, armR: [150, 144], armL: [106, 146], mouth: 'smile', hy: 0 }],
      [10, { tape: 0.12, mouth: 'w' }]]));
    return out;
  }
  function typewriter(tired) {
    const W = worker(tired, { prop: 'typewriter', balls: tired ? 5 : 0 });
    const out = []; let page = 0.15;
    const line = () => {
      for (let k = 0; k < 10; k++) out.push(...W([[3, { page, carriage: -0.9 + k * 0.2, armL: [114, k % 2 ? 178 : 170], armR: [142, k % 2 ? 170 : 178] }]]));
      out.push(...W([[5, { page, carriage: 1.1, fx: 'ding', look: [-2, 0], armL: [114, 174], armR: [142, 174] }], [5, { page, carriage: 1.1, armL: [70, 152], armR: [142, 174] }],
                     [6, { page: page + 0.15, carriage: -0.9, armL: [96, 152], armR: [142, 174] }]]));
      page += 0.15;
    };
    for (let r = 0; r < 2; r++) {
      for (let l = 0; l < 4; l++) line();
      out.push(...W([[20, { page, carriage: -0.9, look: [0, -2], mouth: 'flat' }], [10, { page, carriage: -0.9, look: [0, -2], brows: 'cross', mouth: 'wobble' }],
        [5, { page, carriage: -0.9, armL: [116, 116], armR: [140, 116] }], [4, { page: 0, carriage: -0.9, armL: [112, 128], armR: [144, 128], fx: 'rip', ball: 1 }],
        [12, { page: 0, carriage: -0.9, armL: [120, 150], armR: [136, 150], ball: 1, eyes: 'squint', mouth: 'flat' }],
        [4, { page: 0, carriage: -0.9, armR: [168, 104], ball: 1, toss: 0 }], [12, { page: 0, carriage: -0.9, armR: [180, 90], toss: 1, eyes: 'look', look: [3, -2] }],
        [14, { page: 0.15, carriage: -0.9, eyes: 'happy', mouth: 'smile' }]]));
      page = 0.15;
    }
    return out;
  }
  function scientist(tired) {
    const W = worker(tired, { prop: 'lab', hat: 'goggles', singed: tired ? 1 : 0 });
    const out = [];
    const brew = boom => {
      const s = tired ? 1 : 0;
      out.push(...W([[18, { levelL: 0.8, levelR: 0.35, boil: 0.15, singed: s, look: [-2, 3] }], [10, { levelL: 0.8, levelR: 0.35, boil: 0.15, singed: s, look: [2, 3] }],
        [10, { levelL: 0.8, levelR: 0.35, pour: 0.5, armL: [118, 160], boil: 0.15, singed: s }],
        [24, { levelL: 0.2, levelR: 0.9, pour: 1, armL: [130, 140], boil: 0.3, singed: s, look: [2, 2], mouth: 'o' }],
        [10, { levelL: 0.2, levelR: 0.9, pour: 0, boil: 0.4, singed: s }],
        [24, { levelL: 0.2, levelR: 0.9, boil: 0.7, eyes: 'wide', look: [2, 2], singed: s, mouth: 'flat' }],
        [16, { levelL: 0.2, levelR: 0.9, boil: 1, eyes: 'wide', look: [2, 2], x: 2, singed: s, mouth: 'wobble' }]]));
      if (boom) {
        out.push(...W([[3, { levelL: 0.2, levelR: 0.3, boil: 0, fx: 'poof', poof: 0.35, squash: 0.1 }], [8, { levelL: 0.2, levelR: 0.3, fx: 'poof', poof: 1, singed: 1, eyes: 'closed' }],
          [16, { levelL: 0.2, levelR: 0.3, singed: 1, eyes: 'dot', look: [0, 0], mouth: 'flat', earL: 0.25, earR: 0.25 }], [4, { levelL: 0.2, levelR: 0.3, singed: 1, eyes: 'closed' }],
          [16, { levelL: 0.2, levelR: 0.3, singed: 1, eyes: 'dot', look: [0, 0], mouth: 'flat' }],
          [16, { levelL: 0.2, levelR: 0.3, singed: 1, armR: [146, 106], eyes: 'closed' }], [20, { levelL: 0.2, levelR: 0.3, singed: 1, mouth: 'wobble', blush: true, look: [2, 0] }]]));
      } else {
        out.push(...W([[4, { levelL: 0.2, levelR: 0.9, boil: 0.5, eyes: 'happy', mouth: 'open', armL: [86, 96], armR: [170, 96], fx: 'eureka', singed: s }],
          [26, { levelL: 0.2, levelR: 0.9, boil: 0.4, eyes: 'happy', mouth: 'open', armL: [84, 90], armR: [172, 90], fx: 'eureka', singed: s, y: -4 }],
          [14, { levelL: 0.2, levelR: 0.9, boil: 0.3, eyes: 'happy', mouth: 'smile', singed: s }]]));
      }
    };
    brew(true); brew(false);
    return out;
  }
  // the acts back to back, with a puff of smoke to swap his gear (and round from the last to the first)
  const POOF_SWAP = (prev, next) => [[mix(prev, { fx: 'poof', poof: 0.15 }), 3], [mix(prev, { fx: 'poof', poof: 0.45 }), 3], [mix(next, { fx: 'poof', poof: 0.75 }), 3], [mix(next, { fx: 'poof', poof: 1 }), 3]];
  function shift(tired) {
    const frames = [];
    for (const act of [accountant, typewriter, scientist]) {
      const a = act(tired);
      if (frames.length) frames.push(...POOF_SWAP(frames[frames.length - 1][0], a[0][0]));
      frames.push(...a);
    }
    frames.push(...POOF_SWAP(frames[frames.length - 1][0], frames[0][0]));
    return frames;
  }
  const HOLD = new Set(['working', 'longhaul']);      // loops made of held beats (not one continuous sway)
  const MOODS = {
    idle: () => Array.from({ length: 8 }, (_, i) => [mix(SLEEP, { squash: 0.02 + wave(i, 8, 0.02), hy: 4 + wave(i, 8, 1.5) }), 6]),
    night: () => Array.from({ length: 8 }, (_, i) => [mix(SLEEP, { wrap: true, squash: 0.12 + wave(i, 8, 0.015), hy: 8 + wave(i, 8, 1), tilt: 0.14, earL: 0.45, earR: 0.4, fx: 'night' }), 8]),
    working: () => shift(false),
    longhaul: () => shift(true),
    alert: () => Array.from({ length: 6 }, (_, i) => [mix(AWAKE, { eyes: 'wide', mouth: i % 3 === 0 ? 'o' : 'smile', armR: i % 2 ? [176, 84] : [186, 98], armL: null, y: i % 3 === 1 ? -6 : 0, squash: i % 3 === 2 ? 0.05 : 0, perk: 1.08, tail: 0.25, fx: 'alert' }), 3]),
    waiting: () => Array.from({ length: 6 }, (_, i) => [mix(AWAKE, { eyes: 'wide', brows: 'worried', mouth: 'wobble', armR: i % 2 ? [178, 82] : [188, 100], armL: i % 2 ? [80, 100] : [70, 84], y: i % 2 ? -10 : 0, squash: i % 2 ? -0.05 : 0.06, perk: 1.1, tail: 0.35 + wave(i, 6, 0.15), fx: 'waiting' }), 3]),
    done: () => {
      const ys = [0, -7, -12, -15, -12, -7, 0, 0], sq = [0.12, -0.06, -0.08, -0.05, -0.08, -0.06, 0.12, 0.02];
      return ys.map((y, i) => [mix(AWAKE, { eyes: 'happy', mouth: 'open', blush: true, y, squash: sq[i], armL: [84, 100 + y], armR: [172, 100 + y], tail: 0.35, curl: 0.25, fx: 'done' }), 3]);
    },
    meeting: () => Array.from({ length: 6 }, (_, i) => [mix(AWAKE, { eyes: 'wide', mouth: i % 2 ? 'o' : 'flat', brows: 'up', armL: [106, 176], armR: [152, 176], prop: 'clock', ring: i % 2, squash: i % 2 ? 0.03 : 0, perk: 1.06, fx: 'none' }), 3]),
    awake: () => {
      const looks = [[0, 0], [0, 0], [-3, 0], [-3, 0], [0, 0], [3, 0], [3, 0], [0, 0]];
      return looks.map((look, i) => [mix(AWAKE, { eyes: i === 4 ? 'closed' : 'look', look, tilt: look[0] * 0.02, earL: look[0] < 0 ? -0.12 : 0, earR: look[0] > 0 ? -0.12 : 0, tail: wave(i, 8, 0.15), mouth: 'w', fx: 'awake' }), 5]);
    },
    letter: () => Array.from({ length: 6 }, (_, i) => [mix(AWAKE, { eyes: 'happy', mouth: 'smile', armL: [104, 172 - (i % 2) * 3], armR: [152, 172 - (i % 2) * 3], prop: 'letter', y: i % 3 === 0 ? -3 : 0, tail: 0.2 + wave(i, 6, 0.2), fx: 'none' }), 4]),
  };
  const firstPose = {};
  for (const m of MOMENTS) {
    const frames = MOODS[m]();
    firstPose[m] = frames[0][0];
    LOOPS[m] = smooth(frames, !HOLD.has(m)).map(([p, t]) => [add(m, p), t]);
  }

  // ---------- in between: blend one pose into another ----------
  // Keyframes [pose, ticks] -> one drawing per tick. Each pose holds, then eases into the next over its last
  // few ticks (a loop eases the whole way, and round from its last pose back to its first).
  function smooth(frames, loop = false, ease = 4) {
    const out = [], es = u => u * u * (3 - 2 * u);
    frames.forEach(([p, t], k) => {
      const next = frames[k + 1] ? frames[k + 1][0] : loop ? frames[0][0] : null;
      const e = !next ? 0 : loop ? t : Math.min(t, ease);
      for (let j = 0; j < t; j++) {
        const into = j - (t - e);
        if (!next || into < 0) { out.push([p, 1]); continue; }
        const u = loop ? j / t : (into + 1) / (e + 1);
        out.push([blend(p, next, es(u)), 1]);
      }
    });
    return out;
  }
  function blend(a, b, t) {
    const out = Object.assign({}, t < 0.5 ? a : b);
    for (const k of NUM) out[k] = (a[k] ?? R.pose({})[k]) * (1 - t) + (b[k] ?? R.pose({})[k]) * t;
    out.look = [0, 1].map(j => ((a.look || [0, 0])[j]) * (1 - t) + ((b.look || [0, 0])[j]) * t);
    if (!!a.tailFront !== !!b.tailFront || !!a.wrap !== !!b.wrap)      // swinging round to the front: pull it in on the way past
      out.tailK = (out.tailK || 1) * (1 - 0.4 * Math.sin(Math.PI * t));
    for (const k of ['leaf', 'bubble'])                  // drifting leaf, growing bubble: smooth too, while both have one
      if (typeof a[k] === 'number' && typeof b[k] === 'number' && a[k] >= 0 && b[k] >= 0) out[k] = a[k] * (1 - t) + b[k] * t;
    for (const k of ['tape', 'crank', 'page', 'carriage', 'pour', 'boil', 'levelL', 'levelR', 'toss', 'poof', 'tilthat'])   // his work props
      if (typeof a[k] === 'number' && typeof b[k] === 'number') out[k] = a[k] * (1 - t) + b[k] * t;
    for (const s of ['L', 'R']) {
      const ka = a['arm' + s], kb = b['arm' + s];
      if (!ka && !kb) { out['arm' + s] = null; continue; }
      const pa = ka || TUCK[s], pb = kb || TUCK[s];
      out['arm' + s] = (t > 0.85 && !kb) || (t < 0.15 && !ka) ? null : [pa[0] * (1 - t) + pb[0] * t, pa[1] * (1 - t) + pb[1] * t];
    }
    return out;
  }
  // n drawings from a to b, a blink and a little squash at the switch, ease in and out
  function tween(a, b, n = 12, ticks = 1, o = {}) {
    const out = [];
    for (let i = 1; i <= n; i++) {
      const t = i / n, e = t * t * (3 - 2 * t), p = blend(a, b, e);
      if (o.blink !== false && Math.abs(t - 0.5) < 0.5 / n + 0.01 && a.eyes !== b.eyes) p.eyes = 'closed';
      p.squash = (p.squash || 0) + Math.sin(t * Math.PI) * (o.squash ?? 0.06);
      p.fx = t < 0.5 ? a.fx : b.fx;
      // his gear appears and disappears in a puff of smoke (and a puff covers leaving work mid-act)
      if (((a.prop || '') !== (b.prop || '') || (a.hat || '') !== (b.hat || '')) && t > 0.25 && t < 0.85) { p.fx = 'poof'; p.poof = (t - 0.25) / 0.6; }
      if (o.poofStart && t <= 0.3) { p.fx = 'poof'; p.poof = 0.5 + t / 0.3 * 0.5; }
      out.push([p, ticks]);
    }
    return out;
  }
  const seq = (name, frames) => frames.map(([p, t]) => [add(name, p), t]);

  // every mood to every other: a direct, drawn move
  for (const a of MOMENTS) for (const b of MOMENTS) {
    if (a === b) continue;
    const pa = firstPose[a], pb = firstPose[b];
    const mid = mix(AWAKE, { eyes: 'dot', fx: 'none' });           // through a plain awake pose when both ends are busy
    const busy = p => p.prop || p.wrap || p.armL || p.armR;
    const ps = { poofStart: HOLD.has(a) };                // he may be leaving mid-act: hide the jump in a puff
    const frames = busy(pa) && busy(pb) ? [...tween(pa, mid, 10, 1, ps), ...tween(mid, pb, 10)] : tween(pa, pb, 16, 1, ps);
    TRANS[`${a}>${b}`] = seq(`t_${a}_${b}`, frames);
  }

  // ---------- events ----------
  const STAND = mix(AWAKE);
  const hold = (p, ticks) => [[p, ticks]];
  // An event that starts and ends in mood m: walk from m's pose to standing, play the beats, walk back.
  function event(name, m, beats, o = {}) {
    const from = firstPose[m], start = o.start || STAND;
    const into = o.noInto ? [] : tween(from, start, 10, 1, { poofStart: HOLD.has(m) });
    const out = o.noOut ? [] : tween(beats.length ? beats[beats.length - 1][0] : start, from, 12);
    CLIPS[name] = { home: m, seq: seq(name, [...into, ...smooth([[start, 4], ...beats]), ...out]) };
  }
  // beats: [ticks, patch] in order, each on top of the standing pose (or o.base)
  const beat = (list, base = STAND) => list.map(([t, p]) => [mix(base, p), t]);

  const smoothFrom = (p, beats) => smooth([[p, 3], ...beats]);
  // fidgets while asleep (no walking to standing: he stays asleep)
  const S = firstPose.idle;
  CLIPS.fidget_toss = { home: 'idle', seq: seq('fidget_toss', smoothFrom(S, beat([[6, { lean: -0.06, tilt: -0.08 }], [8, { lean: -0.1, tilt: -0.14, earL: 0.5, mouth: 'wobble' }], [20, { lean: -0.04, tilt: 0.12, earR: 0.5 }], [6, { lean: 0.03, tilt: 0.1 }], [8, {}]], S))) };
  CLIPS.fidget_twitch = { home: 'idle', seq: seq('fidget_twitch', smoothFrom(S, beat([[4, {}], [3, { earL: -0.25 }], [3, { earL: 0.4 }], [3, { earL: -0.2 }], [6, { earL: 0.3 }], [4, { earR: -0.25 }], [3, { earR: 0.35 }], [8, {}]], S))) };
  CLIPS.fidget_bubble = { home: 'idle', seq: seq('fidget_bubble', smoothFrom(S, beat([[6, { bubble: 4 }], [8, { bubble: 8 }], [8, { bubble: 12 }], [10, { bubble: 15 }], [4, { bubble: -1, eyes: 'squint', earL: -0.1, earR: -0.1 }], [8, { eyes: 'closed' }], [6, {}]], S))) };
  // hello: wakes, stretches, waves, settles back down
  event('hello', 'idle', beat([[6, { eyes: 'squint', mouth: 'open', squash: -0.08, armL: [96, 96], armR: [160, 96] }], [8, { eyes: 'squint', mouth: 'open', squash: -0.1, armL: [92, 86], armR: [164, 86] }],
    [5, { eyes: 'happy', mouth: 'smile', armR: [176, 92] }], [5, { eyes: 'happy', mouth: 'smile', armR: [186, 104] }], [5, { eyes: 'happy', mouth: 'smile', armR: [176, 92] }], [5, { eyes: 'happy', mouth: 'smile', armR: [186, 104] }], [10, { eyes: 'dot', mouth: 'w', tail: 0.2 }]]), { start: STAND });
  // oops (while working): a startled jolt, a paw to the face, a sheepish look, back to it
  event('oops', 'working', beat([[3, { eyes: 'wide', mouth: 'o', y: -6, perk: 1.15, prop: 'adder', hat: 'visor' }], [10, { eyes: 'wide', mouth: 'o', perk: 1.15, prop: 'adder', hat: 'visor', fx: 'alert' }],
    [10, { eyes: 'closed', mouth: 'wobble', armR: [146, 112], prop: 'adder', hat: 'visor', earL: 0.4, earR: 0.4 }], [12, { eyes: 'squint', mouth: 'wobble', blush: true, prop: 'adder', hat: 'visor', earL: 0.3, earR: 0.3, look: [2, 0] }], [6, { prop: 'adder', hat: 'visor' }]]), { start: mix(STAND, { prop: 'adder', hat: 'visor' }) });

  // ---------- tap gags: each a few beats, played from any daytime mood ----------
  const GAG = {
    pounce: [[4, { squash: 0.13, eyes: 'look', look: [0, 2], earL: -0.15, earR: -0.15, mouth: 'flat', tail: 0.15 }], [3, { squash: 0.14, lean: 0.05, eyes: 'look', look: [0, 2], tail: 0.2 }], [3, { squash: 0.14, lean: -0.05, eyes: 'look', look: [0, 2], tail: 0.1 }], [3, { squash: 0.14, lean: 0.05, eyes: 'look', look: [0, 2], tail: 0.2 }],
             [3, { squash: -0.08, y: -9, perk: 1.06, eyes: 'wide', armL: [96, 128], armR: [160, 128] }], [4, { squash: -0.06, y: -10, eyes: 'wide', mouth: 'open', armL: [100, 156], armR: [156, 156], tail: 0.3 }], [3, { squash: 0.15, y: 0, eyes: 'closed', armL: [104, 196], armR: [152, 196], fx: 'thud', tail: 0.2 }],
             [10, { squash: 0.12, eyes: 'look', look: [0, 4], armL: [110, 194], armR: [146, 194], mouth: 'o' }], [14, { eyes: 'squint', mouth: 'wobble', blush: true, look: [2, 0] }]],
    tailchase: [[4, { eyes: 'look', look: [3, 1], tilt: 0.12, tail: -0.25 }], [3, { x: -8, lean: -0.1, eyes: 'look', look: [3, 2], tailFront: true, tail: -0.9, curl: -0.6 }], [3, { x: -18, lean: -0.18, tailFront: true, tail: -1.4, curl: -0.8 }],
                [3, { x: -10, lean: 0.12, tail: 0.6 }], [3, { x: 4, lean: -0.1, tailFront: true, tail: -1.2, curl: -0.7 }], [3, { x: 14, lean: 0.14, tail: 0.5 }], [3, { x: 4, lean: -0.12, tailFront: true, tail: -1.3, curl: -0.8 }],
                [3, { x: -6, lean: 0.1, tail: 0.6 }], [14, { eyes: 'spiral', mouth: 'wobble', lean: 0.06, tilt: -0.1, fx: 'dizzy' }], [10, { eyes: 'spiral', mouth: 'wobble', lean: -0.05, tilt: 0.1, fx: 'dizzy' }]],
    sneeze: [[6, { eyes: 'squint', mouth: 'flat', tilt: -0.05 }], [6, { eyes: 'squint', mouth: 'o', tilt: -0.1, hy: -1, squash: -0.02 }], [8, { eyes: 'closed', mouth: 'open', tilt: -0.15, hy: -2, squash: -0.04, perk: 1.03 }],
             [3, { eyes: 'closed', mouth: 'grin', tilt: 0.16, hy: 6, squash: 0.18, earL: -0.3, earR: -0.3, fx: 'sneeze' }], [6, { eyes: 'closed', mouth: 'flat', tilt: 0.1, hy: 4, squash: 0.1, earL: 0.4, earR: 0.4, fx: 'sneeze' }], [12, { eyes: 'squint', mouth: 'w', blush: true }]],
    howl: [[6, { eyes: 'dot', mouth: 'w', tilt: -0.1, hy: -2, prop: 'moon' }], [6, { eyes: 'closed', mouth: 'o', tilt: -0.2, hy: -1, squash: -0.03, prop: 'moon', tail: 0.4 }], [16, { eyes: 'closed', mouth: 'o', tilt: -0.22, hy: -2, squash: -0.04, prop: 'moon', fx: 'awoo', tail: 0.45 }],
           [8, { eyes: 'closed', mouth: 'o', tilt: -0.2, hy: -1, prop: 'moon', fx: 'awoo2' }], [12, { eyes: 'squint', mouth: 'wobble', blush: true, tilt: 0.06, prop: 'moon' }]],
    zoomies: [[4, { squash: 0.14, eyes: 'wide', perk: 1.12, lean: -0.1 }], [2, { x: 40, lean: 0.3, squash: -0.06, fx: 'speedR' }], [2, { x: 78, lean: 0.3, fx: 'speedR' }], [2, { x: 40, lean: -0.3, fx: 'speedL' }], [2, { x: -20, lean: -0.3, fx: 'speedL' }],
              [2, { x: -70, lean: -0.3, fx: 'speedL' }], [2, { x: -20, lean: 0.3, fx: 'speedR' }], [2, { x: 30, lean: 0.3, fx: 'speedR' }], [2, { x: 10, lean: -0.2 }], [4, { x: 0, squash: 0.14 }], [16, { eyes: 'happy', mouth: 'open', squash: 0.04, tail: 0.3, fx: 'pant' }]],
    hiccup: [[8, {}], [2, { y: -5, squash: -0.05, eyes: 'wide', mouth: 'o', perk: 1.08, fx: 'hic' }], [10, { eyes: 'look', look: [0, 0], mouth: 'flat', fx: 'hic' }], [2, { y: -6, squash: -0.05, eyes: 'wide', mouth: 'o', perk: 1.08, fx: 'hic' }],
             [12, { eyes: 'squint', mouth: 'wobble', brows: 'worried', fx: 'hic' }], [2, { y: -7, squash: -0.06, eyes: 'wide', mouth: 'o', perk: 1.1, fx: 'hic' }], [12, { eyes: 'closed', mouth: 'flat', squash: 0.04 }]],
    leaf: [[8, { leaf: 0, eyes: 'look', look: [0, -3], tilt: -0.04 }], [8, { leaf: 1, eyes: 'look', look: [0, -2] }], [8, { leaf: 2, eyes: 'cross', mouth: 'flat' }], [12, { leaf: 3, eyes: 'cross', mouth: 'wobble' }],
           [4, { leaf: 3, eyes: 'closed', mouth: 'o', squash: -0.04 }], [3, { leaf: 4, eyes: 'closed', mouth: 'o', fx: 'puff' }], [3, { leaf: 5, eyes: 'squint' }], [10, { leaf: 6, eyes: 'happy', mouth: 'smile' }]],
    boop: [[3, { eyes: 'closed', squash: 0.12, earL: 0.6, earR: 0.6, hy: 4, fx: 'boop' }], [6, { eyes: 'happy', squash: 0.06, earL: 0.4, earR: 0.4, blush: true, mouth: 'smile' }],
           [4, { eyes: 'happy', mouth: 'open', blush: true, lean: -0.05 }], [4, { eyes: 'happy', mouth: 'open', blush: true, lean: 0.05 }], [4, { eyes: 'happy', mouth: 'open', blush: true, lean: -0.05 }], [10, { eyes: 'happy', mouth: 'smile', blush: true, tail: 0.3 }]],
    yawn: [[6, { eyes: 'squint', mouth: 'o', squash: -0.04 }], [8, { eyes: 'closed', mouth: 'open', squash: -0.06, tilt: -0.1, hy: -1, armL: [92, 96], armR: [164, 96], perk: 0.9 }], [10, { eyes: 'closed', mouth: 'grin', squash: -0.08, tilt: -0.12, hy: -2, armL: [86, 88], armR: [170, 88], earL: 0.2, earR: 0.2 }],
           [4, { eyes: 'closed', mouth: 'w', squash: 0.06 }], [4, { eyes: 'squint', mouth: 'smile', squash: 0.02 }], [10, { eyes: 'squint', mouth: 'w' }]],
    peekaboo: [[5, { eyes: 'look', look: [3, 0] }], [4, { tailFront: true, tail: -1.9, curl: -0.9, eyes: 'closed' }], [14, { tailFront: true, tail: -2.1, curl: -1.1, eyes: 'closed' }], [3, { tailFront: true, tail: -1.4, curl: -0.6, eyes: 'wide' }],
               [4, { tail: 0.4, eyes: 'happy', mouth: 'open', y: -8, armL: [80, 104], armR: [176, 104], fx: 'boo' }], [12, { eyes: 'happy', mouth: 'smile', blush: true, tail: 0.25 }]],
    disco: [[4, { prop: 'shades', mouth: 'smile' }], [4, { prop: 'shades', mouth: 'grin', lean: 0.1, armR: [178, 84], armL: [104, 168], fx: 'disco' }], [4, { prop: 'shades', mouth: 'grin', lean: -0.1, armL: [78, 84], armR: [152, 168], fx: 'disco' }],
            [4, { prop: 'shades', mouth: 'grin', lean: 0.1, armR: [178, 84], armL: [104, 168], fx: 'disco' }], [4, { prop: 'shades', mouth: 'grin', lean: -0.1, armL: [78, 84], armR: [152, 168], fx: 'disco' }],
            [4, { prop: 'shades', mouth: 'grin', squash: 0.1, armL: [86, 120], armR: [170, 120], fx: 'disco' }], [4, { prop: 'shades', mouth: 'grin', y: -10, squash: -0.08, armL: [84, 86], armR: [172, 86], fx: 'disco' }], [12, { prop: 'shades', mouth: 'smile', tail: 0.3 }]],
  };
    // three dances
  GAG.floss = [[5, { x: -10, lean: -0.11, tilt: 0.08, hx: 3, eyes: "look", look: [3, 1], mouth: "flat", tail: 0.18, armL: [172, 194], armR: [188, 182] }], [5, { x: 10, lean: 0.11, tilt: -0.08, hx: -3, eyes: "look", look: [-3, 1], mouth: "flat", tail: 0.12, armL: [68, 182], armR: [84, 194] }], [4, { x: -10, lean: -0.11, tilt: 0.08, hx: 3, eyes: "look", look: [3, 1], mouth: "flat", tail: 0.18, armL: [172, 194], armR: [188, 182] }], [4, { x: 10, lean: 0.11, tilt: -0.08, hx: -3, eyes: "look", look: [-3, 1], mouth: "flat", tail: 0.12, armL: [68, 182], armR: [84, 194] }], [4, { x: -10, lean: -0.11, tilt: 0.08, hx: 3, eyes: "look", look: [3, 1], mouth: "flat", tail: 0.18, armL: [172, 194], armR: [188, 182] }], [3, { x: 10, lean: 0.11, tilt: -0.08, hx: -3, eyes: "look", look: [-3, 1], mouth: "flat", tail: 0.12, armL: [68, 182], armR: [84, 194] }], [3, { x: -10, lean: -0.11, tilt: 0.08, hx: 3, eyes: "look", look: [3, 1], mouth: "flat", tail: 0.18, armL: [172, 194], armR: [188, 182] }], [3, { x: 10, lean: 0.11, tilt: -0.08, hx: -3, eyes: "look", look: [-3, 1], mouth: "flat", tail: 0.12, armL: [68, 182], armR: [84, 194] }], [14, { eyes: "happy", mouth: "open", blush: true, tail: 0.3 }]];
  GAG.dab = [[5, { squash: 0.12, eyes: "look", look: [0, 2], mouth: "flat", armL: [110, 182], armR: [146, 182] }], [3, { squash: -0.04, eyes: "closed", tilt: -0.28, hx: -6, hy: 2, armL: [48, 74], armR: [104, 108], mouth: "flat", tail: 0.3, fx: "swag" }], [14, { squash: -0.04, eyes: "closed", tilt: -0.3, hx: -7, hy: 2, armL: [46, 72], armR: [102, 106], mouth: "flat", tail: 0.35, fx: "swag" }], [4, { squash: 0.1, eyes: "dot", mouth: "w" }], [3, { squash: -0.04, eyes: "closed", tilt: 0.28, hx: 6, hy: 2, armR: [208, 74], armL: [152, 108], mouth: "flat", tail: -0.1, fx: "swag" }], [14, { squash: -0.04, eyes: "closed", tilt: 0.3, hx: 7, hy: 2, armR: [210, 72], armL: [154, 106], mouth: "flat", tail: -0.1, fx: "swag" }], [14, { eyes: "squint", mouth: "smile", brows: "up", look: [2, 0], tail: 0.25 }]];
  GAG.dubstep = [[6, { hy: 4, eyes: "closed", mouth: "flat", tail: -0.05, fx: "notes" }], [6, { hy: -1, eyes: "closed", mouth: "flat", tail: 0.1, fx: "notes" }], [5, { hy: 4, eyes: "closed", mouth: "flat", tail: -0.05, fx: "notes" }], [5, { hy: -1, eyes: "closed", mouth: "flat", tail: 0.1, fx: "notes" }], [4, { hy: 4, eyes: "closed", mouth: "flat", tail: -0.05, fx: "notes" }], [4, { hy: -1, eyes: "closed", mouth: "flat", tail: 0.1, fx: "notes" }], [3, { hy: 4, eyes: "closed", mouth: "flat", tail: -0.05, fx: "notes" }], [3, { hy: -1, eyes: "closed", mouth: "flat", tail: 0.1, fx: "notes" }], [2, { hy: 4, eyes: "closed", mouth: "flat", tail: -0.05, fx: "notes" }], [2, { hy: -1, eyes: "closed", mouth: "flat", tail: 0.1, fx: "notes" }], [2, { hy: 4, eyes: "closed", mouth: "flat", tail: -0.05, fx: "notes" }], [2, { hy: -1, eyes: "closed", mouth: "flat", tail: 0.1, fx: "notes" }], [6, { squash: -0.05, y: -3, eyes: "wide", mouth: "o", perk: 1.05, prop: "shades", fx: "notes" }], [1, { x: -3, y: 0, squash: 0.1, lean: -0.06, earL: 0.4, earR: 0.4, mouth: "grin", prop: "shades", armL: [84, 110], armR: [172, 140], tail: -0.2, fx: "wub" }], [1, { x: -5, y: -2, squash: -0.04, lean: 0.06, earL: -0.3, earR: -0.3, mouth: "grin", prop: "shades", armL: [84, 140], armR: [172, 110], tail: 0.5, fx: "wub" }], [1, { x: 5, y: -2, squash: -0.04, lean: -0.06, earL: -0.3, earR: -0.3, mouth: "grin", prop: "shades", armL: [84, 110], armR: [172, 140], tail: 0.5, fx: "wub" }], [1, { x: -5, y: 0, squash: 0.1, lean: -0.06, earL: -0.3, earR: -0.3, mouth: "grin", prop: "shades", armL: [84, 140], armR: [172, 110], tail: 0.5, fx: "wub" }], [1, { x: -5, y: -2, squash: -0.04, lean: 0.06, earL: 0.4, earR: 0.4, mouth: "grin", prop: "shades", armL: [84, 110], armR: [172, 140], tail: 0.5, fx: "wub" }], [1, { x: 5, y: 0, squash: -0.04, lean: 0.06, earL: -0.3, earR: -0.3, mouth: "grin", prop: "shades", armL: [84, 140], armR: [172, 110], tail: -0.2, fx: "wub" }], [1, { x: 5, y: 0, squash: 0.1, lean: 0.06, earL: 0.4, earR: 0.4, mouth: "grin", prop: "shades", armL: [84, 110], armR: [172, 140], tail: 0.5, fx: "wub" }], [1, { x: 5, y: 0, squash: -0.04, lean: 0.06, earL: 0.4, earR: -0.3, mouth: "grin", prop: "shades", armL: [84, 140], armR: [172, 110], tail: 0.5, fx: "wub" }], [1, { x: -5, y: -2, squash: -0.04, lean: -0.06, earL: 0.4, earR: -0.3, mouth: "grin", prop: "shades", armL: [84, 110], armR: [172, 140], tail: -0.2, fx: "wub" }], [1, { x: 3, y: -2, squash: 0.1, lean: -0.06, earL: -0.3, earR: 0.4, mouth: "grin", prop: "shades", armL: [84, 140], armR: [172, 110], tail: 0.5, fx: "wub" }], [1, { x: -5, y: -2, squash: -0.04, lean: -0.06, earL: 0.4, earR: -0.3, mouth: "grin", prop: "shades", armL: [84, 110], armR: [172, 140], tail: -0.2, fx: "wub" }], [1, { x: 3, y: -2, squash: -0.04, lean: 0.06, earL: -0.3, earR: -0.3, mouth: "grin", prop: "shades", armL: [84, 140], armR: [172, 110], tail: -0.2, fx: "wub" }], [1, { x: 5, y: 0, squash: 0.1, lean: 0.06, earL: 0.4, earR: -0.3, mouth: "grin", prop: "shades", armL: [84, 110], armR: [172, 140], tail: -0.2, fx: "wub" }], [1, { x: 3, y: 0, squash: -0.04, lean: -0.06, earL: -0.3, earR: -0.3, mouth: "grin", prop: "shades", armL: [84, 140], armR: [172, 110], tail: -0.2, fx: "wub" }], [1, { x: 5, y: -2, squash: -0.04, lean: 0.06, earL: -0.3, earR: -0.3, mouth: "grin", prop: "shades", armL: [84, 110], armR: [172, 140], tail: 0.5, fx: "wub" }], [1, { x: 3, y: -2, squash: 0.1, lean: -0.06, earL: 0.4, earR: 0.4, mouth: "grin", prop: "shades", armL: [84, 140], armR: [172, 110], tail: 0.5, fx: "wub" }], [1, { x: 5, y: 0, squash: -0.04, lean: -0.06, earL: 0.4, earR: 0.4, mouth: "grin", prop: "shades", armL: [84, 110], armR: [172, 140], tail: -0.2, fx: "wub" }], [1, { x: 3, y: -2, squash: -0.04, lean: 0.06, earL: 0.4, earR: 0.4, mouth: "grin", prop: "shades", armL: [84, 140], armR: [172, 110], tail: -0.2, fx: "wub" }], [14, { eyes: "spiral", mouth: "wobble", earL: 0.5, earR: 0.45, squash: 0.06, fx: "dizzy" }]];
  for (const g of GAGS) for (const m of MOMENTS) {
    if (m === 'night') continue;
    event(`tap_${g}_${m}`, m, beat(GAG[g]));
  }
  // at night only a soft startle: one eye opens, he grumbles, back to sleep
  const N = firstPose.night;
  CLIPS.tap_startle_night = { home: 'night', seq: seq('startle', smoothFrom(N, beat([[3, { squash: 0.06, earL: 0.1, earR: 0.1 }], [8, { eyes: 'squint', earR: 0, mouth: 'flat' }], [10, { eyes: 'squint', mouth: 'wobble', brows: 'cross' }], [6, { eyes: 'closed', mouth: 'flat' }], [10, {}]], N))) };
  // meeting prep: checks a pocket watch, straightens up, nods
  for (const m of MOMENTS) {
    if (m === 'night') continue;
    event(`tap_prep_${m}`, m, beat([[8, { prop: 'clock', armL: [106, 176], armR: [152, 176], eyes: 'look', look: [0, 3] }], [8, { prop: 'clock', ring: 1, armL: [106, 176], armR: [152, 176], eyes: 'wide', brows: 'up' }],
      [6, { squash: -0.06, perk: 1.1, mouth: 'smile' }], [4, { hy: 4 }], [4, {}], [4, { hy: 4 }], [8, { mouth: 'w' }]]));
  }

  // ---------- props and marks ----------
  const PROPS = {
    adder(c, P, a, seed) {
      const x = 128 + (P.x || 0), y = 201;
      // the paper tape: up out of the machine, over the top, and down again as it grows
      const L = (P.tape || 0) * 80, x0 = x - 8, y0 = y - 27, tp = [[x0, y0]];
      for (let s = 3; s <= L; s += 3) {
        if (s <= 34) tp.push([x0, y0 - s]);
        else if (s <= 78) { const th = (s - 34) / 44 * Math.PI; tp.push([x0 - 14 + Math.cos(th) * 14, y0 - 34 - Math.sin(th) * 14]); }
        else tp.push([x0 - 28, Math.min(y0 - 34 + (s - 78), 196)]);
      }
      if (tp.length > 1) { trace(c, tp, false); c.lineCap = 'butt'; c.strokeStyle = INK; c.lineWidth = 11; c.stroke(); c.strokeStyle = CREAM; c.lineWidth = 7; c.stroke(); c.lineCap = 'round'; }
      if (P.pileTape) for (let k = 0; k < 4; k++) { c.beginPath(); c.ellipse(62 + k * 9, 194 - (k % 2) * 3, 13, 5, 0.25 * k, 0, Math.PI * 2); c.strokeStyle = INK; c.lineWidth = 7; c.stroke(); c.strokeStyle = CREAM; c.lineWidth = 4; c.stroke(); }
      part(c, [[x - 34, y], [x + 34, y], [x + 30, y - 28], [x - 30, y - 28]], '#8A8F9C', seed + 800, { width: 3.4 });
      for (let r = 0; r < 2; r++) for (let k = 0; k < 4; k++) dot(c, x - 16 + k * 10, y - 19 + r * 9, 2.6, CREAM);
      const cr = P.crank || 0, hx = x + 42, hy = y - 24 + cr * 20;                 // the crank on the side
      stroke(c, [[x + 30, y - 14], [hx, hy]], seed + 801, 3.4, ink()); dot(c, hx, hy, 4.5, '#E8454B');
      if (P.strip) {                                                              // the torn-off strip, held up to read
        const s0 = P.armR ? [(P.armR[0] + (P.armL ? P.armL[0] : P.armR[0] - 40)) / 2, P.armR[1] - 6] : [128, 112];
        part(c, [[s0[0] - 24, s0[1] - 6], [s0[0] + 24, s0[1] - 6], [s0[0] + 24, s0[1] + 6], [s0[0] - 24, s0[1] + 6]], CREAM, seed + 802, { width: 2.4, lineColour: INK });
        for (let k = 0; k < 4; k++) stroke(c, [[s0[0] - 18 + k * 10, s0[1]], [s0[0] - 12 + k * 10, s0[1]]], seed + 803 + k, 1.6, '#888');
      }
    },
    typewriter(c, P, a, seed) {
      const x = 128 + (P.x || 0), y = 201, sh = -(P.carriage || 0) * 14;
      const ph = 12 + (P.page || 0) * 52, top = y - 34 - ph;                       // the page rises out of the roller
      part(c, [[x + sh - 24, y - 34], [x + sh + 24, y - 34], [x + sh + 24, top], [x + sh - 24, top]], CREAM, seed + 820, { width: 2.6, lineColour: INK, wobble: 0.5 });
      for (let k = 0; k < Math.floor((P.page || 0) * 7); k++) { const ly = top + 8 + k * 7; if (ly < y - 38) stroke(c, [[x + sh - 18, ly], [x + sh + 14 - (k % 3) * 6, ly]], seed + 821 + k, 1.6, '#8A8A8A'); }
      part(c, [[x + sh - 40, y - 40], [x + sh + 40, y - 40], [x + sh + 40, y - 31], [x + sh - 40, y - 31]], '#2B2F38', seed + 830, { width: 3 });
      stroke(c, [[x + sh - 40, y - 36], [x + sh - 52, y - 48]], seed + 831, 3.2, ink()); dot(c, x + sh - 53, y - 49, 4.2, '#E8454B');
      part(c, [[x - 42, y], [x + 42, y], [x + 36, y - 30], [x - 36, y - 30]], '#3E4452', seed + 832, { width: 3.4 });
      for (let r = 0; r < 3; r++) for (let k = 0; k < 6 - r; k++) dot(c, x - 25 + r * 5 + k * 10, y - 22 + r * 7, 2.6, CREAM);
      if (P.ball && !(P.toss > 0)) crumple(c, x, 146, seed);
      if (P.toss > 0 && P.toss < 1) { const t = P.toss; crumple(c, 172 + t * 72, 96 - t * 112 + t * t * 30, seed); }
      for (let k = 0; k < (P.balls || 0); k++) crumple(c, 56 + (k % 3) * 14, 193 - Math.floor(k / 3) * 13, seed + k);
    },
    lab(c, P, a, seed, tick) {
      const flask = (fx, fy, rot, level, colour, k) => {
        const shape = [[-5, -34, 1], [5, -34, 1], [5, -22, 1], [16, -3], [13, 2, 1], [-13, 2, 1], [-16, -3], [-5, -22, 1]];
        c.save(); c.translate(fx, fy); c.rotate(rot);
        trace(c, shape, true); c.fillStyle = 'rgba(200,230,255,.22)'; c.fill();
        c.save(); trace(c, shape, true); c.clip(); c.fillStyle = colour; c.fillRect(-20, 2 - level * 30, 40, level * 30 + 4); c.restore();
        part(c, shape, null, seed + 840 + k, { width: 3, wobble: 0.4 });
        c.restore();
      };
      const p = P.pour || 0, boil = P.boil || 0, shake = boil > 0.9 ? (tick % 2 ? 1.5 : -1.5) : 0;
      const rx = 162 + (P.x || 0) + shake, ry = 199, mix2 = (P.levelR || 0) > 0.6;
      const colourR = mix2 ? '#6EE7B7' : '#B983FF';
      flask(rx, ry, 0, P.levelR ?? 0.35, colourR, 0);
      for (let k = 0; k < Math.round(1 + boil * 6); k++) {                        // bubbles out of the top
        const yy = ry - 36 - ((tick * (1 + boil * 2) + k * 11) % 34), r = 2 + (k % 3) * (0.5 + boil);
        c.beginPath(); c.arc(rx + Math.sin(k * 2.3 + tick * 0.25) * 5, yy, r, 0, Math.PI * 2); c.fillStyle = mix2 ? 'rgba(110,231,183,.75)' : 'rgba(185,131,255,.75)'; c.fill();
      }
      const lx = 96 + (P.x || 0) + (rx - 30 - 96) * p, ly = 199 - 40 * p;          // the other flask, lifted and tipped to pour
      flask(lx, ly, 1.75 * p, P.levelL ?? 0.8, '#7CFC9A', 1);
      if (p > 0.8) { const mx = lx + Math.cos(1.75 * p - Math.PI / 2) * 34, my = ly + Math.sin(1.75 * p - Math.PI / 2) * 34; stroke(c, [[mx, my], [rx - 2, ry - 36]], seed + 850, 3.2, '#7CFC9A'); }
    },
    laptop(c, P, a, seed, tick) {
      const x = 128 + (P.x || 0), y = 201;
      part(c, [[x - 34, y - 32], [x + 34, y - 32], [x + 38, y - 2], [x - 38, y - 2]], '#4B4F5C', seed + 600, { width: 3.6 });
      part(c, [[x - 44, y - 4], [x + 44, y - 4], [x + 46, y + 1], [x - 46, y + 1]], '#6C7180', seed + 610, { width: 3 });
      dot(c, x, y - 18, 3.2, CREAM);                         // a little light on the lid
      if (P.tap) { const tx = x + (P.tap === 'L' ? -16 : 16); stroke(c, [[tx - 4, y - 38], [tx - 6, y - 44]], seed + 620, 2.4, ink()); stroke(c, [[tx + 4, y - 38], [tx + 6, y - 44]], seed + 621, 2.4, ink()); }
    },
    clock(c, P, a, seed) {
      const x = 129 + (P.x || 0) + (P.ring ? 1.5 : -1.5), y = (P.armL ? P.armL[1] - 4 : 172) + (P.y || 0);
      for (const s of [-1, 1]) part(c, oval(x + s * 14, y - 20, 7, 5, 8), '#FFD23F', seed + 633 + s, { width: 2.6 });
      part(c, oval(x, y, 23, 23, 16), '#E8454B', seed + 629, { width: 3.6, lineColour: ink() });
      part(c, oval(x, y, 16, 16, 14), CREAM, seed + 630, { width: 2.4, lineColour: INK });
      stroke(c, [[x, y], [x, y - 10]], seed + 631, 2.8); stroke(c, [[x, y], [x + 7, y + 3]], seed + 632, 2.8); dot(c, x, y, 2.4);
      if (P.ring) for (const s of [-1, 1]) { stroke(c, [[x + s * 28, y - 24], [x + s * 36, y - 30]], seed + 640 + s, 3, ink()); stroke(c, [[x + s * 31, y - 10], [x + s * 40, y - 10]], seed + 642 + s, 3, ink()); }
    },
    letter(c, P, a, seed) {
      const x = 128 + (P.x || 0), y = (P.armL ? P.armL[1] - 2 : 172) + (P.y || 0);      // held out in front of him
      part(c, [[x - 30, y - 18], [x + 30, y - 18], [x + 30, y + 18], [x - 30, y + 18]], '#BFE0FF', seed + 650, { width: 3.4, lineColour: ink() });
      stroke(c, [[x - 28, y - 16], [x, y + 3], [x + 28, y - 16]], seed + 651, 2.6);
      part(c, oval(x, y + 3, 6, 6, 10), '#E8454B', seed + 652, { width: 2.2 });
    },
    moon(c, P, a, seed) {
      c.save(); c.beginPath(); c.arc(48, 46, 18, 0, Math.PI * 2); c.fillStyle = '#FFE9A8'; c.fill();
      c.beginPath(); c.arc(56, 40, 16, 0, Math.PI * 2); c.globalCompositeOperation = 'destination-out'; c.fill(); c.restore();
    },
    shades(c, P, a, seed) {
      const { eL, eR } = a;
      for (const e of [eL, eR]) { trace(c, wob([[e[0] - 11, e[1] - 6], [e[0] + 11, e[1] - 6], [e[0] + 9, e[1] + 6], [e[0] - 9, e[1] + 6]], seed + 660, 0.6), true); c.fillStyle = INK; c.fill(); }
      stroke(c, [[eL[0] + 10, eL[1] - 4], [eR[0] - 10, eR[1] - 4]], seed + 661, 2.6);
      dot(c, eL[0] - 4, eL[1] - 2, 1.6, '#fff'); dot(c, eR[0] - 4, eR[1] - 2, 1.6, '#fff');
    },
  };
  const ink = () => F.ink();
  const text = (c, s, x, y, size, rot = 0, colour) => {
    c.save(); c.translate(x, y); c.rotate(rot); c.font = `700 ${size}px ui-rounded, "SF Pro Rounded", "Arial Rounded MT Bold", sans-serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = colour || ink(); c.fillText(s, 0, 0); c.restore();
  };
  function drawFX(c, fx, P, tick, seed) {
    const t = tick / 24, x = 128 + (P.x || 0), y = P.y || 0;
    if (fx === 'idle' || fx === 'night') {
      const big = fx === 'night' ? 1.25 : 1, sp = fx === 'night' ? 0.7 : 1;
      for (let k = 0; k < 3; k++) {
        const ph = ((t * 0.45 * sp + k / 3) % 1), a = ph < 0.15 ? ph / 0.15 : ph > 0.8 ? (1 - ph) / 0.2 : 1;
        c.save(); c.globalAlpha = Math.max(0, a) * 0.9; text(c, 'z', 172 + ph * 26 + k * 2, 70 - ph * 40, (11 + ph * 10) * big, -0.2); c.restore();
      }
    }
    if (fx === 'alert' || fx === 'waiting') {
      const n = fx === 'waiting' ? 2 : 1, bob = Math.floor(tick / 3) % 2 ? -3 : 0;
      for (let k = 0; k < n; k++) text(c, '!', x + 52 + k * 14, 46 + y + bob, 30, 0.15, '#FFC94A');
    }
    if (fx === 'done' || fx === 'disco') {
      const cols = fx === 'disco' ? ['#FF5A8A', '#5AB8FF', '#58D68D', '#FFD23F'] : [CREAM];
      for (let k = 0; k < 5; k++) {
        const a = k / 5 * Math.PI * 2 + Math.floor(tick / 4) * 0.4, r = 82 + (k % 2) * 10, s = 4 + ((Math.floor(tick / 4) + k) % 3) * 2;
        const sx = x + Math.cos(a) * r, sy = 120 + y + Math.sin(a) * r * 0.75;
        c.fillStyle = cols[k % cols.length]; c.beginPath();
        c.moveTo(sx, sy - s); c.lineTo(sx + s * 0.3, sy - s * 0.3); c.lineTo(sx + s, sy); c.lineTo(sx + s * 0.3, sy + s * 0.3);
        c.lineTo(sx, sy + s); c.lineTo(sx - s * 0.3, sy + s * 0.3); c.lineTo(sx - s, sy); c.lineTo(sx - s * 0.3, sy - s * 0.3); c.closePath(); c.fill();
      }
    }
    if (fx === 'sweat') { const d = (t * 0.6) % 1; c.save(); c.globalAlpha = 1 - d; part(c, [[176, 92 + d * 14], [182, 106 + d * 14], [176, 112 + d * 14], [170, 106 + d * 14]], '#7CC4FF', seed + 700, { width: 2.4 }); c.restore(); }
    if (fx === 'dizzy') for (let k = 0; k < 3; k++) { const a = t * 5 + k * 2.1; text(c, '✦', x + Math.cos(a) * 34, 58 + Math.sin(a) * 8, 12, 0, '#FFD23F'); }
    if (fx === 'sneeze') { for (let k = 0; k < 5; k++) dot(c, x + 24 + k * 9, 132 + (k % 2) * 6 - k * 2, 2.4, CREAM); }
    if (fx === 'awoo' || fx === 'awoo2') text(c, fx === 'awoo' ? 'awoo~' : 'oo~', x + 56, 56, 18, -0.2);
    if (fx === 'hic') text(c, 'hic!', x + 56, 72, 16, 0.2);
    if (fx === 'thud') for (const s of [-1, 1]) stroke(c, [[x + s * 50, 196], [x + s * 64, 186]], seed + 710 + s, 3, ink());
    if (fx === 'speedR' || fx === 'speedL') { const s = fx === 'speedR' ? -1 : 1; for (let k = 0; k < 3; k++) stroke(c, [[x + s * 60, 130 + k * 24], [x + s * 96, 130 + k * 24]], seed + 720 + k, 3, ink()); }
    if (fx === 'pant') { const o = Math.floor(tick / 3) % 2; text(c, 'hah', x + 54, 104 + o * 3, 14, 0.15); }
    if (fx === 'puff') for (let k = 0; k < 3; k++) { c.beginPath(); c.arc(x + 4 + k * 10, 128 - k * 4, 4 + k * 2, 0, Math.PI * 2); c.strokeStyle = ink(); c.lineWidth = 2; c.stroke(); }
    if (fx === 'boop') { const p = [x + 2, 112]; for (let k = 0; k < 2; k++) { c.beginPath(); c.arc(p[0], p[1], 10 + k * 8, -2.6, -0.5); c.strokeStyle = ink(); c.lineWidth = 2.4; c.stroke(); } }
    if (fx === 'boo') text(c, 'boo!', x + 58, 66, 18, 0.15, '#FFC94A');
    if (fx === 'chunk') text(c, 'ka-chunk!', x - 58, 150, 13, -0.15);
    if (fx === 'ding') text(c, 'ding!', x - 66, 136, 15, -0.2, '#FFD23F');
    if (fx === 'rip') text(c, 'rrip', x + 52, 108, 14, 0.2);
    if (fx === 'eureka') { drawFX(c, 'done', P, tick, seed); text(c, 'eureka!', x, 40, 18, -0.08, '#6EE7B7'); }
    if (fx === 'poof') {                                   // a cloud of smoke: swells, then thins away
      const p = Math.max(0, Math.min(1, P.poof ?? 0.5)), al = Math.sin(Math.PI * p), R = 30 + 34 * p;
      c.save(); c.globalAlpha = al; c.fillStyle = '#E9E4DA';
      for (let k = 0; k < 8; k++) { const an = k / 8 * Math.PI * 2 + 0.4; c.beginPath(); c.arc(x + Math.cos(an) * R, 140 + Math.sin(an) * R * 0.7, 20 + 12 * p, 0, Math.PI * 2); c.fill(); }
      c.beginPath(); c.arc(x, 140, R * 0.9, 0, Math.PI * 2); c.fill();
      c.globalAlpha = al * 0.9; text(c, 'poof', x, 140, 20, -0.1, '#8A8378'); c.restore();
    }
    if (fx === 'swag') for (let k = 0; k < 3; k++) { const a = -0.6 + k * 0.6, r = 96 + (Math.floor(tick / 3) + k) % 2 * 6; text(c, '✦', x + Math.cos(a) * r, 104 + Math.sin(a) * r * 0.6, 11 + (k % 2) * 4, 0, '#FFD23F'); }
    if (fx === 'notes') for (let k = 0; k < 2; k++) { const ph = (t * 0.8 + k * 0.5) % 1; c.save(); c.globalAlpha = 1 - ph; text(c, k ? '♫' : '♪', x - 56 + k * 116, 96 - ph * 40, 18, 0); c.restore(); }
    if (fx === 'wub') { const s = 1 + (tick % 3) * 0.15; text(c, 'WUB', x + (tick % 2 ? -50 : 50), 50 + (tick % 2) * 6, 22 * s, tick % 2 ? -0.2 : 0.2, '#5AB8FF'); }
  }
  // crumpled paper: a lumpy ball with a couple of creases
  function crumple(c, x, y, seed) {
    const pts = []; for (let k = 0; k < 9; k++) { const an = k / 9 * Math.PI * 2, r = 8 + F.rnd(seed, k) * 3; pts.push([x + Math.cos(an) * r, y + Math.sin(an) * r, k % 2]); }
    part(c, pts, CREAM, seed + 890, { width: 2.4, lineColour: INK, wobble: 0.3 });
    stroke(c, [[x - 4, y - 3], [x + 1, y + 1], [x + 4, y - 2]], seed + 891, 1.4, '#8A8A8A');
  }
  // things he wears on his head, drawn in his head's own position and tilt
  const HATS = {
    visor(c, P, a, seed) {
      const H = q => a.H(a.T(q));
      c.save();
      if (P.tilthat) { const p0 = H([128, 94]); c.translate(p0[0], p0[1]); c.rotate(P.tilthat); c.translate(-p0[0], -p0[1]); }
      part(c, [[84, 96], [104, 86], [128, 83], [152, 86], [172, 96], [168, 106], [128, 101], [88, 106]].map(H), 'rgba(46,170,90,.88)', seed + 860, { width: 3 });
      c.restore();
    },
    goggles(c, P, a, seed) {
      const H = q => a.H(a.T(q));
      stroke(c, [H([80, 106]), a.eL.map((v, i) => v + (i ? 0 : -11))], seed + 870, 4, '#5B4636');
      stroke(c, [a.eR.map((v, i) => v + (i ? 0 : 11)), H([176, 106])], seed + 871, 4, '#5B4636');
      for (const e of [a.eL, a.eR]) { c.beginPath(); c.arc(e[0], e[1], 11, 0, Math.PI * 2); c.fillStyle = 'rgba(170,220,255,.35)'; c.fill(); c.lineWidth = 4; c.strokeStyle = '#C9A15B'; c.stroke(); }
      stroke(c, [[a.eL[0] + 11, a.eL[1]], [a.eR[0] - 11, a.eR[1]]], seed + 872, 3, '#C9A15B');
    },
  };
  function messAndScorch(c, P, a, seed, tick) {
    if (P.cups) for (let k = 0; k < P.cups; k++) {                                // the long haul's coffee cups
      const cx = 30, cy = 200 - k * 12;
      part(c, [[cx - 8, cy], [cx + 8, cy], [cx + 10, cy - 13], [cx - 10, cy - 13]], CREAM, seed + 880 + k, { width: 2.4, lineColour: INK, wobble: 0.4 });
      c.fillStyle = '#8B5A3C'; c.fillRect(cx - 8, cy - 9, 16, 4);
    }
    if (P.singed) {                                                               // soot smudges, and smoke off his ear tips
      const H = q => a.H(a.T(q));
      for (const [sx, sy, r] of [[100, 128, 6], [158, 124, 5], [130, 80, 7]]) { const p = H([sx, sy]); c.beginPath(); c.ellipse(p[0], p[1], r, r * 0.7, 0.4, 0, Math.PI * 2); c.fillStyle = 'rgba(40,30,30,.45)'; c.fill(); }
      for (const ex of [82, 174]) {
        const p = H([ex, 32]);
        for (let k = 0; k < 3; k++) { const ph = ((tick / 24) * 0.7 + k / 3) % 1; c.save(); c.globalAlpha = (1 - ph) * 0.7; c.beginPath(); c.arc(p[0] + Math.sin(ph * 6 + k) * 4, p[1] - ph * 26, 3 + ph * 4, 0, Math.PI * 2); c.fillStyle = '#9A9A9A'; c.fill(); c.restore(); }
      }
    }
  }
  function drawExtras(c, P, a, seed, tick) {
    messAndScorch(c, P, a, seed, tick);
    if (P.prop && PROPS[P.prop] && P.prop !== 'moon') PROPS[P.prop](c, P, a, seed, tick);
    if (P.hat && HATS[P.hat]) HATS[P.hat](c, P, a, seed);
    if (P.bubble) {                                     // snore bubble from his nose
      const n = a.nose;
      if (P.bubble > 0) { c.beginPath(); c.arc(n[0] + 8 + P.bubble * 0.4, n[1] + 6, P.bubble, 0, Math.PI * 2); c.fillStyle = 'rgba(160,210,255,.35)'; c.fill(); c.strokeStyle = ink(); c.lineWidth = 2; c.stroke(); }
      else for (let k = 0; k < 5; k++) { const a2 = k / 5 * Math.PI * 2; stroke(c, [[n[0] + 14 + Math.cos(a2) * 8, n[1] + 6 + Math.sin(a2) * 8], [n[0] + 14 + Math.cos(a2) * 14, n[1] + 6 + Math.sin(a2) * 14]], seed + 730 + k, 2, ink()); }
    }
    if (P.leaf !== undefined) {                          // a leaf drifting down onto his nose, then blown away
      const path = [[150, 20], [118, 50], [140, 82], [129, 112], [129, 112], [168, 70], [210, 30]];
      const f = Math.min(P.leaf, path.length - 1), i0 = Math.floor(f), i1 = Math.min(path.length - 1, i0 + 1), u = f - i0;
      const q = [path[i0][0] * (1 - u) + path[i1][0] * u, path[i0][1] * (1 - u) + path[i1][1] * u];
      c.save(); c.translate(q[0] + (P.x || 0), q[1]); c.rotate(P.leaf * 0.7);
      part(c, [[-10, 0], [0, -6], [12, 0], [0, 6]], '#E0892B', seed + 740, { width: 2.4 }); stroke(c, [[-12, 0], [12, 0]], seed + 741, 1.6);
      c.restore();
    }
  }

  // ---------- drawing a frame ----------
  function render(c, m, id, tick, opts = {}) {
    const P = D[id] || D[LOOPS.idle[0][0]];
    const seed = 11;                                       // the same for every drawing, so nothing jumps between them
    F.now = opts.still ? 0 : (opts.time ?? performance.now() / 1000);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = F.line === 'paper' ? F.PAPER_BG : '#000'; c.fillRect(0, 0, 240, 240);
    // (the rig draws his floor shadow first: the app relies on the first fill of a frame being the shadow)
    R.draw(c, Object.assign({}, P, { front: (cc, a, s, t) => drawExtras(cc, P, a, s, t) }), seed, tick);
    if (P.prop === 'moon') PROPS.moon(c, P, null, seed);
    if (!opts.noFX) drawFX(c, P.fx || 'none', P, tick, seed);
  }

  const fxFor = id => (D[id] && D[id].fx) || 'none';
  const meta = () => ({
    moments: MOMENTS.map(m => ({ name: m, base: MOMENTS.indexOf(BASE[m]) })),
    seqs: [...MOMENTS.map(m => ({ key: m, kind: 0, from: m, to: m, name: m })),
           ...Object.keys(TRANS).map(k => { const [a, b] = k.split('>'); return { key: k, kind: 1, from: a, to: b, name: k }; }),
           ...Object.keys(CLIPS).map(n => ({ key: n, kind: 2, from: CLIPS[n].home, to: CLIPS[n].home, name: n }))],
  });

  window.__character = {
    // silent: his gags ask the bridge for no sounds (it only has Lump's, which would be the wrong ones)
    name: 'fox', GAGS, silent: true, render, fxFor, D, LOOPS, TRANS, CLIPS, MOMENTS, meta,
    setTint: v => { F.tint = v; }, setLine: v => { F.line = v; }, setProp: () => {},
  };
})();
