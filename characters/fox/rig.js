// The fox's rig: draw him in any pose. A pose is a plain object; anything left out takes its default.
//
//   build    'bean' (one round body, like a sitting bean) | 'chibi' (big head on a small body) | 'loaf' (low and wide, tail wrapped round)
//   x, y     shift (from standing centred on the floor)
//   squash   + flattens and widens him, - stretches him tall
//   lean     tilt of his whole body about his feet (radians, + leans right)
//   tilt     extra tilt of his head (radians)
//   earL, earR   ear turn (radians, + droops outward); perk scales ear length (1 = normal)
//   tail     tail swing (radians, + up/forward), curl (bends it further along its length), tailK size,
//            tailFront true to draw it in front of him (wrapped round him like a blanket)
//   hx, hy   head shift (nods and bobs); armL, armR [x, y] where a paw is (null = paws tucked away)
//   held     which paw holds the 'front' prop: 'L' | 'R' | 'both' (just documentation for props)
//   eyes     'dot' | 'closed' | 'happy' | 'wide' | 'squint' | 'x' | 'spiral' | 'look'
//   look     [dx, dy] where his pupils point (for 'dot', 'wide', 'look')
//   mouth    'w' | 'smile' | 'open' | 'grin' | 'o' | 'flat' | 'wobble' | 'none'
//   blush    true for pink cheeks
//   brows    'none' | 'worried' | 'cross' | 'up'
//   front, back   extra drawing callbacks (c, anchors, seed, tick) in front of / behind him
(() => {
  const F = window.__foxDraw;
  const { CREAM, INK, DARK, part, marking, stroke, dot, oval, turn, trace, wob } = F;
  const FLOOR = 201, CX = 128;

  const BUILDS = {
    bean: {
      body: [[76, 201], [70, 168], [76, 128], [94, 98], [128, 86], [162, 98], [180, 128], [186, 168], [180, 201], [128, 204]],
      head: null,
      earL: { base: [106, 94], pts: [[80, 112], [72, 74], [78, 46, 1], [108, 64], [128, 90]] },
      face: { y: 126, ex: 17, nose: 138, muzzle: [[90, 136], [106, 130], [120, 134], [128, 139], [136, 134], [150, 130], [166, 136], [152, 152], [128, 158], [104, 152]] },
      chest: [128, 194, 26, 22],
      socks: [[106, 200], [150, 200]], sockR: [11, 6],
      tail: { base: [178, 188], pts: [[172, 198], [204, 200], [228, 182], [236, 150], [226, 120], [208, 112], [204, 132], [214, 156], [202, 176], [178, 178]], tip: [224, 124, 20] },
    },
    chibi: {
      body: [[98, 201], [94, 176], [104, 150], [128, 144], [152, 150], [162, 176], [158, 201], [128, 204]],
      head: [[82, 118], [80, 96], [94, 74], [128, 64], [162, 74], [176, 96], [174, 118], [190, 134, 1], [164, 140], [128, 152], [92, 140], [66, 134, 1]],
      earL: { base: [102, 78], pts: [[80, 94], [74, 56], [80, 30, 1], [106, 50], [122, 72]] },
      face: { y: 110, ex: 17, nose: 123, muzzle: [[70, 132], [96, 122], [118, 126], [128, 131], [138, 126], [160, 122], [186, 132], [162, 150], [128, 158], [94, 150]] },
      chest: [128, 184, 18, 22],
      socks: [[114, 200], [142, 200]], sockR: [9, 5],
      tail: { base: [150, 190], spine: [[148, 192], [170, 198], [190, 188], [200, 164], [198, 138], [186, 116]], width: 1,
              wrap: [[150, 196], [128, 202], [100, 202], [78, 196], [62, 182], [62, 164]] },
    },
    loaf: {
      body: [[62, 201], [60, 180], [72, 160], [100, 150], [156, 150], [184, 160], [196, 180], [194, 201], [128, 204]],
      head: [[88, 136], [88, 114], [100, 96], [128, 88], [156, 96], [168, 114], [168, 136], [180, 148, 1], [158, 154], [128, 164], [98, 154], [76, 148, 1]],
      earL: { base: [106, 100], pts: [[88, 114], [82, 78], [88, 54, 1], [112, 72], [126, 96]] },
      face: { y: 128, ex: 15, nose: 140, muzzle: [[78, 146], [100, 138], [120, 142], [128, 146], [136, 142], [156, 138], [178, 146], [158, 162], [128, 170], [98, 162]] },
      chest: null,
      socks: [], sockR: [0, 0],
      tail: { front: true, base: [190, 196], pts: [[196, 196], [170, 203], [110, 204], [66, 201], [46, 192], [40, 180], [54, 176], [70, 184], [110, 188], [168, 186], [192, 182]], tip: [52, 186, 18] },
    },
  };
  const mirrorX = p => [2 * CX - p[0], p[1], p[2]];

  function pose(p) {
    return Object.assign({ build: 'chibi', x: 0, y: 0, squash: 0, lean: 0, tilt: 0, hx: 0, hy: 0, earL: 0, earR: 0, perk: 1,
                           tail: 0, curl: 0, tailK: 1, tailFront: false, armL: null, armR: null,
                           eyes: 'dot', look: [0, 0], mouth: 'w', blush: false, brows: 'none' }, p);
  }

  // Squash/stretch and lean about his feet, then shift.
  function body(P) {
    const sx = 1 + P.squash * 0.55, sy = 1 - P.squash;
    return q => {
      let x = CX + (q[0] - CX) * sx, y = FLOOR + (q[1] - FLOOR) * sy;
      const r = turn([x, y], CX, FLOOR, P.lean);
      return [r[0] + P.x, r[1] + P.y, q[2]];
    };
  }

  function drawEye(c, kind, x, y, look, seed) {
    const [lx, ly] = look;
    if (kind === 'dot' || kind === 'look') return dot(c, x + lx, y + ly, 4.6);
    if (kind === 'closed') return stroke(c, [[x - 7, y - 1], [x, y + 3.5], [x + 7, y - 1]], seed, 3);
    if (kind === 'happy') return stroke(c, [[x - 7, y + 2], [x, y - 4.5], [x + 7, y + 2]], seed, 3.2);
    if (kind === 'squint') return stroke(c, [[x - 7, y], [x + 7, y]], seed, 3.2);
    if (kind === 'wide') { dot(c, x, y, 7.5, F.fur()); c.lineWidth = 2; c.strokeStyle = INK; c.beginPath(); c.arc(x, y, 7.5, 0, Math.PI * 2); c.stroke(); dot(c, x + lx * 1.4, y + ly * 1.4, 3.8); dot(c, x + lx * 1.4 + 1.5, y + ly * 1.4 - 1.6, 1.2, '#fff'); return; }
    if (kind === 'x') { stroke(c, [[x - 5, y - 5], [x + 5, y + 5]], seed, 3); stroke(c, [[x + 5, y - 5], [x - 5, y + 5]], seed + 1, 3); return; }
    if (kind === 'spiral') { const P = []; for (let a = 0; a < 12; a += 0.6) P.push([x + Math.cos(a) * a * 0.6, y + Math.sin(a) * a * 0.6]); return stroke(c, P, seed, 2.2); }
  }
  function drawMouth(c, kind, x, y, seed) {
    if (kind === 'none') return;
    if (kind === 'w') { stroke(c, [[x - 8, y], [x - 4, y + 3.5], [x, y]], seed, 2.6); stroke(c, [[x, y], [x + 4, y + 3.5], [x + 8, y]], seed + 3, 2.6); return; }
    if (kind === 'smile') return stroke(c, [[x - 8, y], [x, y + 5], [x + 8, y]], seed, 2.8);
    if (kind === 'flat') return stroke(c, [[x - 6, y + 2], [x + 6, y + 2]], seed, 2.8);
    if (kind === 'wobble') return stroke(c, [[x - 8, y + 2], [x - 4, y], [x, y + 2], [x + 4, y], [x + 8, y + 2]], seed, 2.4);
    if (kind === 'o') { c.beginPath(); c.ellipse(x, y + 4, 4, 5, 0, 0, Math.PI * 2); c.fillStyle = INK; c.fill(); return; }
    if (kind === 'open' || kind === 'grin') {
      const w = kind === 'grin' ? 13 : 9, h = kind === 'grin' ? 11 : 12;
      const M = [[x - w, y], [x + w, y], [x + w * 0.6, y + h * 0.75], [x, y + h], [x - w * 0.6, y + h * 0.75]];
      trace(c, wob(M, seed, 0.8), true); c.fillStyle = INK; c.fill();
      c.save(); trace(c, M, true); c.clip(); c.beginPath(); c.ellipse(x, y + h, w * 0.6, h * 0.45, 0, 0, Math.PI * 2); c.fillStyle = '#E8735F'; c.fill(); c.restore();
    }
  }

  function draw(c, raw, seed, tick = 0) {
    const P = pose(raw), B = BUILDS[P.build], T = body(P);
    const bodyPts = B.body.map(T);
    const headPts = B.head && B.head.map(T);
    // head turn: about the middle of where head meets body
    const neck = T([CX, B.head ? 146 : 120]);
    const H = q => { const r = P.tilt ? turn(q, neck[0], neck[1], P.tilt) : q; return [r[0] + P.hx, r[1] + P.hy, q[2]]; };
    const shell = headPts ? headPts.map(H) : bodyPts;      // the shape his face sits on

    // shadow
    c.fillStyle = F.line === 'glow' ? 'rgba(255,241,220,.10)' : '#CFC8BC';
    const air = Math.max(0, -P.y), shrink = Math.max(0.35, 1 - air / 90);
    c.beginPath(); c.ellipse(CX + P.x + 4, FLOOR + 2, 58 * (1 + P.squash * 0.4) * shrink, 6 * shrink, 0, 0, Math.PI * 2); c.fill();

    if (raw.back) raw.back(c, { T, H }, seed, tick);

    // The generated tail: sample the spine, bend it (tail swings the whole thing, curl bends it more
    // towards the tip), then walk out to each side by a width that swells and tapers to a soft point,
    // with tufts of fur along the outer edge and at the tip.
    const spineTail = () => {
      const sp = P.wrap ? B.tail.wrap : B.tail.spine, N = 22, pts = [];
      const cr = (a, b, c2, d, t) => 0.5 * (2 * b + (-a + c2) * t + (2 * a - 5 * b + 4 * c2 - d) * t * t + (-a + 3 * b - 3 * c2 + d) * t * t * t);
      for (let i = 0; i < N; i++) {
        const u = i / (N - 1) * (sp.length - 1), k = Math.min(Math.floor(u), sp.length - 2), t = u - k;
        const a = sp[Math.max(0, k - 1)], b = sp[k], c2 = sp[k + 1], d = sp[Math.min(sp.length - 1, k + 2)];
        pts.push([cr(a[0], b[0], c2[0], d[0], t), cr(a[1], b[1], c2[1], d[1], t)]);
      }
      const base = pts[0];
      const bent = pts.map((q, i) => turn(q, base[0], base[1], -(P.tail + P.curl * Math.pow(i / (N - 1), 1.4)), P.tailK));
      const L = [], R = [];
      for (let i = 0; i < N; i++) {
        const p0 = bent[Math.max(0, i - 1)], p1 = bent[Math.min(N - 1, i + 1)], dx = p1[0] - p0[0], dy = p1[1] - p0[1], len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len, ny = dx / len, t = i / (N - 1);
        const w = (7 + 15 * Math.sin(Math.min(1, t * 1.15) * Math.PI * 0.92)) * P.tailK * B.tail.width * (P.wrap ? 0.8 : 1);
        const tuft = (i % 4 === 2 && i > 3 && i < N - 2) ? 6 : 0;
        L.push([bent[i][0] + nx * (w + tuft), bent[i][1] + ny * (w + tuft), tuft ? 1 : 0]);
        R.push([bent[i][0] - nx * w * 0.9, bent[i][1] - ny * w * 0.9]);
      }
      const end = bent[N - 1], prev = bent[N - 3], ex = end[0] - prev[0], ey = end[1] - prev[1], el = Math.hypot(ex, ey) || 1;
      const tip = [end[0] + ex / el * 10, end[1] + ey / el * 10, 1];
      const outline = [...L, tip, ...R.reverse()].map(T);
      const tipAt = T(bent[N - 4]);
      return { outline, tip: [tipAt[0], tipAt[1], 17 * P.tailK] };
    };

    // tail (behind, unless it wraps round the front)
    const tailPts = () => {
      const tb = T(B.tail.base);
      if (B.tail.front) return B.tail.pts.map(T);
      return B.tail.pts.map(q => turn(T(q), tb[0], tb[1], -P.tail, P.tailK));
    };
    const drawTail = () => {
      let tp, tipC;
      if (B.tail.spine) { const g = spineTail(); tp = g.outline; tipC = g.tip; }
      else {
        const tb = T(B.tail.base); tp = tailPts();
        const t0 = B.tail.front ? T(B.tail.tip) : turn(T(B.tail.tip), tb[0], tb[1], -P.tail, P.tailK);
        tipC = [t0[0], t0[1], B.tail.tip[2] * P.tailK];
      }
      part(c, tp, F.tint, seed + 300);
      marking(c, tp, oval(tipC[0], tipC[1], tipC[2], tipC[2] * 1.15, 12), F.fur(), seed + 310);
      part(c, tp, null, seed + 300);          // redraw the outline over the white tip
    };
    const tailInFront = B.tail.front || P.tailFront || P.wrap;
    if (!tailInFront) drawTail();

    // ears (behind the head)
    const ear = (side) => {
      const e = B.earL, flip = side === 'R' ? mirrorX : (p => p);
      const base = H(T(flip(e.base))), a = (side === 'R' ? 1 : -1) * (side === 'R' ? P.earR : P.earL);
      const pts = e.pts.map(q => turn(H(T(flip(q))), base[0], base[1], a, 1)).map((q, i) => {
        if (i === 2 && P.perk !== 1) return [base[0] + (q[0] - base[0]) * P.perk, base[1] + (q[1] - base[1]) * P.perk, q[2]];
        return q;
      });
      part(c, pts, F.tint, seed + (side === 'R' ? 210 : 200));
      // dark tip and a pale inner ear
      const tip = pts[2];
      marking(c, pts, oval(tip[0], tip[1] + 4, 13, 15, 10), DARK, seed + 220);
      const inner = [pts[1], pts[2], pts[3]].map(q => [base[0] + (q[0] - base[0]) * 0.55, base[1] + (q[1] - base[1]) * 0.55 + 4, q[2]]);
      c.save(); trace(c, wob([[base[0], base[1] + 6], ...inner], seed + 230, 1), true); c.fillStyle = F.line === 'glow' ? 'rgba(255,241,220,.55)' : 'rgba(255,253,248,.8)'; c.fill(); c.restore();
      part(c, pts, null, seed + (side === 'R' ? 210 : 200));
    };
    ear('L'); ear('R');

    // body, with white chest and dark socks
    part(c, bodyPts, F.tint, seed);
    if (B.chest) { const ch = T([B.chest[0], B.chest[1]]); marking(c, bodyPts, oval(ch[0], ch[1], B.chest[2], B.chest[3], 12), F.fur(), seed + 10); }
    for (const s of B.socks) { const p = T(s); marking(c, bodyPts, oval(p[0], p[1], B.sockR[0], B.sockR[1], 10), DARK, seed + 20); }
    part(c, bodyPts, null, seed);

    if (headPts) { part(c, shell, F.tint, seed + 100); }
    // white muzzle and cheeks
    marking(c, shell, B.face.muzzle.map(T).map(H), F.fur(), seed + 110);
    if (headPts) part(c, shell, null, seed + 100); else part(c, bodyPts, null, seed);

    // face
    const fc = H(T([CX, B.face.y])), nz = H(T([CX, B.face.nose]));
    const eL = H(T([CX - B.face.ex, B.face.y])), eR = H(T([CX + B.face.ex, B.face.y]));
    if (P.blush) for (const e of [eL, eR]) { c.beginPath(); c.ellipse(e[0] + (e === eL ? -6 : 6), e[1] + 13, 7, 4, 0, 0, Math.PI * 2); c.fillStyle = 'rgba(255,120,120,.45)'; c.fill(); }
    const cross = P.eyes === 'cross';                     // both pupils turned in, at something on his nose
    drawEye(c, cross ? 'dot' : P.eyes, eL[0], eL[1], cross ? [3, 1.5] : P.look, seed + 400);
    drawEye(c, cross ? 'dot' : P.eyes, eR[0], eR[1], cross ? [-3, 1.5] : P.look, seed + 410);
    if (P.brows === 'worried') { stroke(c, [[eL[0] - 8, eL[1] - 10], [eL[0] + 5, eL[1] - 14]], seed + 420, 2.6); stroke(c, [[eR[0] + 8, eR[1] - 10], [eR[0] - 5, eR[1] - 14]], seed + 421, 2.6); }
    if (P.brows === 'cross') { stroke(c, [[eL[0] - 7, eL[1] - 14], [eL[0] + 6, eL[1] - 9]], seed + 420, 2.8); stroke(c, [[eR[0] + 7, eR[1] - 14], [eR[0] - 6, eR[1] - 9]], seed + 421, 2.8); }
    if (P.brows === 'up') { stroke(c, [[eL[0] - 6, eL[1] - 13], [eL[0] + 5, eL[1] - 15]], seed + 420, 2.6); stroke(c, [[eR[0] + 6, eR[1] - 13], [eR[0] - 5, eR[1] - 15]], seed + 421, 2.6); }
    // nose: a small rounded triangle
    const N = [[nz[0] - 6, nz[1] - 3], [nz[0] + 6, nz[1] - 3], [nz[0], nz[1] + 4]];
    trace(c, N, true); c.fillStyle = INK; c.fill();
    drawMouth(c, P.mouth, nz[0], nz[1] + 6, seed + 430);

    if (tailInFront) drawTail();
    // props he holds go under his paws, so the paws grip them
    if (raw.front) raw.front(c, { T, H, eL, eR, nose: nz, face: fc }, seed, tick);
    // paws, in front of everything but props: a short furry arm from the shoulder, a dark mitten of a paw
    for (const side of ['L', 'R']) {
      const hand = side === 'L' ? P.armL : P.armR;
      if (!hand) continue;
      const sh = T([side === 'L' ? 108 : 148, 160]), hp = [hand[0] + P.x, hand[1] + P.y];
      const dx = hp[0] - sh[0], dy = hp[1] - sh[1], len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, nx = -uy * 9, ny = ux * 9;
      const arm = [[sh[0] + nx - ux * 4, sh[1] + ny - uy * 4], [hp[0] + nx * 0.85, hp[1] + ny * 0.85], [hp[0] - nx * 0.85, hp[1] - ny * 0.85], [sh[0] - nx - ux * 4, sh[1] - ny - uy * 4]];
      part(c, arm, F.tint, seed + (side === 'L' ? 500 : 510), { width: 3.6 });
      part(c, oval(hp[0] + ux * 2, hp[1] + uy * 2, 10.5, 9, 12, Math.atan2(dy, dx)), DARK, seed + (side === 'L' ? 520 : 530), { width: 3.4 });
    }
  }

  window.__foxRig = { draw, BUILDS, pose };
})();
