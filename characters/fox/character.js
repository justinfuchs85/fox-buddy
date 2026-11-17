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
  const GAGS = ['pounce', 'tailchase', 'sneeze', 'howl', 'zoomies', 'hiccup', 'leaf', 'boop', 'yawn', 'peekaboo', 'disco'];

  const D = {}, LOOPS = {}, TRANS = {}, CLIPS = {};
  let uid = 0;
  const add = (name, pose) => { const id = name + '_' + (uid++); D[id] = pose; return id; };
  const P0 = { build: 'chibi' };
  const mix = (...ps) => Object.assign({}, P0, ...ps);
  const wave = (i, n, a = 1) => Math.sin(i / n * Math.PI * 2) * a;

  // ---------- the moods: what each looks like, as loops ----------
  // Each returns [pose, ticks] pairs; the first pose is the one transitions start and end on.
  const SLEEP = { eyes: 'closed', mouth: 'none', earL: 0.3, earR: 0.3, tail: 0.06, hy: 4, tilt: 0.06, fx: 'idle' };
  const AWAKE = { eyes: 'dot', mouth: 'w', fx: 'none' };
  const WORK = { eyes: 'look', look: [0, 3.5], mouth: 'flat', perk: 1.04, prop: 'laptop', fx: 'none', hy: 2 };
  const MOODS = {
    idle: () => Array.from({ length: 8 }, (_, i) => [mix(SLEEP, { squash: 0.02 + wave(i, 8, 0.02), hy: 4 + wave(i, 8, 1.5) }), 6]),
    night: () => Array.from({ length: 8 }, (_, i) => [mix(SLEEP, { wrap: true, squash: 0.12 + wave(i, 8, 0.015), hy: 8 + wave(i, 8, 1), tilt: 0.14, earL: 0.45, earR: 0.4, fx: 'night' }), 8]),
    working: () => Array.from({ length: 8 }, (_, i) => [mix(WORK, { hy: 2 + (i % 2), tail: wave(i, 8, 0.08), tap: i % 2 ? 'R' : 'L', look: [i % 4 === 3 ? 2 : 0, 3.5] }), 3]),
    longhaul: () => Array.from({ length: 8 }, (_, i) => [mix(WORK, { eyes: i === 5 ? 'closed' : 'squint', earL: 0.4, earR: 0.35, mouth: 'wobble', squash: 0.04, hy: 4 + (i % 2), tail: 0.05, tap: i % 3 === 0 ? 'L' : null, fx: 'sweat' }), 4]),
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
    LOOPS[m] = frames.map(([p, t]) => [add(m, p), t]);
  }

  // ---------- in between: blend one pose into another ----------
  const NUM = ['x', 'y', 'squash', 'lean', 'tilt', 'hx', 'hy', 'earL', 'earR', 'perk', 'tail', 'curl', 'tailK'];
  const TUCK = { L: [114, 186], R: [142, 186] };
  function blend(a, b, t) {
    const out = Object.assign({}, t < 0.5 ? a : b);
    for (const k of NUM) out[k] = (a[k] ?? R.pose({})[k]) * (1 - t) + (b[k] ?? R.pose({})[k]) * t;
    out.look = [0, 1].map(j => ((a.look || [0, 0])[j]) * (1 - t) + ((b.look || [0, 0])[j]) * t);
    for (const s of ['L', 'R']) {
      const ka = a['arm' + s], kb = b['arm' + s];
      if (!ka && !kb) { out['arm' + s] = null; continue; }
      const pa = ka || TUCK[s], pb = kb || TUCK[s];
      out['arm' + s] = (t > 0.85 && !kb) || (t < 0.15 && !ka) ? null : [pa[0] * (1 - t) + pb[0] * t, pa[1] * (1 - t) + pb[1] * t];
    }
    return out;
  }
  // n drawings from a to b, a blink and a little squash at the switch, ease in and out
  function tween(a, b, n = 6, ticks = 2, o = {}) {
    const out = [];
    for (let i = 1; i <= n; i++) {
      const t = i / n, e = t * t * (3 - 2 * t), p = blend(a, b, e);
      if (o.blink !== false && Math.abs(t - 0.5) < 0.5 / n + 0.01 && a.eyes !== b.eyes) p.eyes = 'closed';
      p.squash = (p.squash || 0) + Math.sin(t * Math.PI) * (o.squash ?? 0.06);
      p.fx = t < 0.5 ? a.fx : b.fx;
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
    const frames = busy(pa) && busy(pb) ? [...tween(pa, mid, 5), ...tween(mid, pb, 5)] : tween(pa, pb, 8);
    TRANS[`${a}>${b}`] = seq(`t_${a}_${b}`, frames);
  }

  // ---------- events ----------
  const STAND = mix(AWAKE);
  const hold = (p, ticks) => [[p, ticks]];
  // An event that starts and ends in mood m: walk from m's pose to standing, play the beats, walk back.
  function event(name, m, beats, o = {}) {
    const from = firstPose[m], start = o.start || STAND;
    const into = o.noInto ? [] : tween(from, start, 5);
    const out = o.noOut ? [] : tween(beats.length ? beats[beats.length - 1][0] : start, from, 6);
    CLIPS[name] = { home: m, seq: seq(name, [...into, ...beats, ...out]) };
  }
  // beats: [ticks, patch] in order, each on top of the standing pose (or o.base)
  const beat = (list, base = STAND) => list.map(([t, p]) => [mix(base, p), t]);

  // fidgets while asleep (no walking to standing: he stays asleep)
  const S = firstPose.idle;
  CLIPS.fidget_toss = { home: 'idle', seq: seq('fidget_toss', beat([[6, { lean: -0.06, tilt: -0.08 }], [8, { lean: -0.1, tilt: -0.14, earL: 0.5, mouth: 'wobble' }], [20, { lean: -0.04, tilt: 0.12, earR: 0.5 }], [6, { lean: 0.03, tilt: 0.1 }], [8, {}]], S)) };
  CLIPS.fidget_twitch = { home: 'idle', seq: seq('fidget_twitch', beat([[4, {}], [3, { earL: -0.25 }], [3, { earL: 0.4 }], [3, { earL: -0.2 }], [6, { earL: 0.3 }], [4, { earR: -0.25 }], [3, { earR: 0.35 }], [8, {}]], S)) };
  CLIPS.fidget_bubble = { home: 'idle', seq: seq('fidget_bubble', beat([[6, { bubble: 4 }], [8, { bubble: 8 }], [8, { bubble: 12 }], [10, { bubble: 15 }], [4, { bubble: -1, eyes: 'squint', earL: -0.1, earR: -0.1 }], [8, { eyes: 'closed' }], [6, {}]], S)) };
  // hello: wakes, stretches, waves, settles back down
  event('hello', 'idle', beat([[6, { eyes: 'squint', mouth: 'open', squash: -0.08, armL: [96, 96], armR: [160, 96] }], [8, { eyes: 'squint', mouth: 'open', squash: -0.1, armL: [92, 86], armR: [164, 86] }],
    [5, { eyes: 'happy', mouth: 'smile', armR: [176, 92] }], [5, { eyes: 'happy', mouth: 'smile', armR: [186, 104] }], [5, { eyes: 'happy', mouth: 'smile', armR: [176, 92] }], [5, { eyes: 'happy', mouth: 'smile', armR: [186, 104] }], [10, { eyes: 'dot', mouth: 'w', tail: 0.2 }]]), { start: STAND });
  // oops (while working): a startled jolt, a paw to the face, a sheepish look, back to it
  event('oops', 'working', beat([[3, { eyes: 'wide', mouth: 'o', y: -6, perk: 1.15, prop: 'laptop' }], [10, { eyes: 'wide', mouth: 'o', perk: 1.15, prop: 'laptop', fx: 'alert' }],
    [10, { eyes: 'closed', mouth: 'wobble', armR: [146, 112], prop: 'laptop', earL: 0.4, earR: 0.4 }], [12, { eyes: 'squint', mouth: 'wobble', blush: true, prop: 'laptop', earL: 0.3, earR: 0.3, look: [2, 0] }], [6, { prop: 'laptop' }]]), { start: mix(STAND, { prop: 'laptop' }) });

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
  for (const g of GAGS) for (const m of MOMENTS) {
    if (m === 'night') continue;
    event(`tap_${g}_${m}`, m, beat(GAG[g]));
  }
  // at night only a soft startle: one eye opens, he grumbles, back to sleep
  const N = firstPose.night;
  CLIPS.tap_startle_night = { home: 'night', seq: seq('startle', beat([[3, { squash: 0.06, earL: 0.1, earR: 0.1 }], [8, { eyes: 'squint', earR: 0, mouth: 'flat' }], [10, { eyes: 'squint', mouth: 'wobble', brows: 'cross' }], [6, { eyes: 'closed', mouth: 'flat' }], [10, {}]], N)) };
  // meeting prep: checks a pocket watch, straightens up, nods
  for (const m of MOMENTS) {
    if (m === 'night') continue;
    event(`tap_prep_${m}`, m, beat([[8, { prop: 'clock', armL: [106, 176], armR: [152, 176], eyes: 'look', look: [0, 3] }], [8, { prop: 'clock', ring: 1, armL: [106, 176], armR: [152, 176], eyes: 'wide', brows: 'up' }],
      [6, { squash: -0.06, perk: 1.1, mouth: 'smile' }], [4, { hy: 4 }], [4, {}], [4, { hy: 4 }], [8, { mouth: 'w' }]]));
  }

  // ---------- props and marks ----------
  const PROPS = {
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
  }
  function drawExtras(c, P, a, seed, tick) {
    if (P.prop && PROPS[P.prop] && P.prop !== 'moon') PROPS[P.prop](c, P, a, seed, tick);
    if (P.bubble) {                                     // snore bubble from his nose
      const n = a.nose;
      if (P.bubble > 0) { c.beginPath(); c.arc(n[0] + 8 + P.bubble * 0.4, n[1] + 6, P.bubble, 0, Math.PI * 2); c.fillStyle = 'rgba(160,210,255,.35)'; c.fill(); c.strokeStyle = ink(); c.lineWidth = 2; c.stroke(); }
      else for (let k = 0; k < 5; k++) { const a2 = k / 5 * Math.PI * 2; stroke(c, [[n[0] + 14 + Math.cos(a2) * 8, n[1] + 6 + Math.sin(a2) * 8], [n[0] + 14 + Math.cos(a2) * 14, n[1] + 6 + Math.sin(a2) * 14]], seed + 730 + k, 2, ink()); }
    }
    if (P.leaf !== undefined) {                          // a leaf drifting down onto his nose, then blown away
      const path = [[150, 20], [118, 50], [140, 82], [129, 112], [129, 112], [168, 70], [210, 30]], q = path[Math.min(P.leaf, path.length - 1)];
      c.save(); c.translate(q[0] + (P.x || 0), q[1]); c.rotate(P.leaf * 0.7);
      part(c, [[-10, 0], [0, -6], [12, 0], [0, 6]], '#E0892B', seed + 740, { width: 2.4 }); stroke(c, [[-12, 0], [12, 0]], seed + 741, 1.6);
      c.restore();
    }
  }

  // ---------- drawing a frame ----------
  function render(c, m, id, tick, opts = {}) {
    const P = D[id] || D[LOOPS.idle[0][0]];
    const seed = opts.still ? 1 : (Math.floor(tick / 2) % 3) * 17 + (id.length * 7);
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
    name: 'fox', GAGS, render, fxFor, D, LOOPS, TRANS, CLIPS, MOMENTS, meta,
    setTint: v => { F.tint = v; }, setLine: v => { F.line = v; }, setProp: () => {},
  };
})();
