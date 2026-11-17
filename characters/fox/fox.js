// The fox: an original character for Desktop Lump, drawn entirely in code.
//
// Nothing here comes from design/lump.html: not its drawings, not its drawing code. The fox is a rig
// (a puppet with a pose), and every drawing is just a pose: how squashed he is, where his ears and tail
// point, which eyes and mouth he's wearing, what he's holding. Moods, transitions and gags are poses
// over time, so a few hundred drawings stay consistent with each other.
//
// The style: a thick, slightly wobbling hand-drawn outline that redraws itself every couple of frames,
// colour fills printed a little off-register (down and to the right of the line), and simple faces.
//
// This file exposes window.__fox with the same shape desktop.js expects from a character:
//   render(ctx, mood, id, tick, opts), fxFor(id), D, LOOPS, TRANS, CLIPS, MOMENTS, meta(), setTint(), setLine()
(() => {
  // ---------- palette ----------
  const CREAM = '#FFF1DC', INK = '#1E1714', PAPER_BG = '#F4EFE6';
  const DARK = '#3A2620';          // ear tips, socks, nose: a warm near-black
  let tint = '#FF7A45', line = 'glow';
  const ink = () => line === 'glow' ? CREAM : INK;
  const fur = () => line === 'glow' ? '#FFF6EA' : '#FFFDF8';     // his white fur (chest, muzzle, tail tip)

  // ---------- drawing primitives ----------
  // Deterministic jitter, so a drawing wobbles the same way every time it's shown with the same seed.
  const rnd = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
  // Points are [x, y] (smooth) or [x, y, 1] (a sharp corner, like an ear tip).
  function wob(pts, seed, amt) {
    return pts.map((p, i) => [p[0] + (rnd(seed, i * 2) - 0.5) * 2 * amt, p[1] + (rnd(seed, i * 2 + 1) - 0.5) * 2 * amt, p[2]]);
  }
  // A path through the points: smooth curves between midpoints, straight into and out of corners.
  function trace(c, pts, closed) {
    const n = pts.length; if (n < 2) return;
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    c.beginPath();
    if (!closed) {
      c.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < n - 1; i++) {
        const m = mid(pts[i], pts[i + 1]);
        if (pts[i][2]) c.lineTo(pts[i][0], pts[i][1]); else c.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]);
      }
      c.lineTo(pts[n - 1][0], pts[n - 1][1]);
      return;
    }
    const start = pts[0][2] ? pts[0] : mid(pts[n - 1], pts[0]);
    c.moveTo(start[0], start[1]);
    for (let k = 0; k < n; k++) {
      const p = pts[k], q = pts[(k + 1) % n];
      if (p[2]) { c.lineTo(p[0], p[1]); continue; }
      const m = q[2] ? q : mid(p, q);
      if (k === 0 && !p[2]) { /* started at the midpoint before p */ }
      c.quadraticCurveTo(p[0], p[1], m[0], m[1]);
    }
    c.closePath();
  }
  // An oval as points, turned by rot.
  function oval(cx, cy, rx, ry, n = 14, rot = 0, a0 = 0) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = a0 + i / n * Math.PI * 2, x = Math.cos(a) * rx, y = Math.sin(a) * ry;
      out.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]);
    }
    return out;
  }
  // Fill a shape off-register in `colour`, then draw its wobbly outline on top.
  function part(c, pts, colour, seed, o = {}) {
    const w = o.wobble ?? 1.6;
    if (colour) {
      c.save(); c.translate(o.offX ?? 3.5, o.offY ?? 2.5);
      trace(c, wob(pts, seed + 50, w), true); c.fillStyle = colour; c.fill();
      c.restore();
    }
    if (o.line !== false) {
      trace(c, wob(pts, seed, w), true);
      c.strokeStyle = o.lineColour || ink(); c.lineWidth = o.width ?? 4; c.lineJoin = c.lineCap = 'round'; c.stroke();
    }
  }
  // Fill a shape (off-register) clipped inside another, with no line: markings like his white chest.
  function marking(c, clipPts, pts, colour, seed) {
    c.save();
    c.translate(3.5, 2.5); trace(c, wob(clipPts, seed + 50, 1.6), true); c.clip();
    c.translate(0, 0); trace(c, wob(pts, seed + 70, 1.2), true); c.fillStyle = colour; c.fill();
    c.restore();
  }
  function stroke(c, pts, seed, width = 3, colour) {
    trace(c, wob(pts, seed, 1), false);
    c.strokeStyle = colour || INK; c.lineWidth = width; c.lineCap = c.lineJoin = 'round'; c.stroke();
  }
  function dot(c, x, y, r, colour) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = colour || INK; c.fill(); }

  // Rotate/scale a point about (ox, oy).
  const turn = (p, ox, oy, a, k = 1) => { const x = (p[0] - ox) * k, y = (p[1] - oy) * k; return [ox + x * Math.cos(a) - y * Math.sin(a), oy + x * Math.sin(a) + y * Math.cos(a), p[2]]; };

  window.__foxDraw = { CREAM, INK, DARK, PAPER_BG, ink, fur, rnd, wob, trace, oval, part, marking, stroke, dot, turn,
                       get tint() { return tint; }, set tint(v) { tint = v; }, get line() { return line; }, set line(v) { line = v; } };
})();
