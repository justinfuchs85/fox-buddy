// Redraws his Live Activity and notification poses and the app icon from the real drawing code.
//   cd ios/tools && npm i canvas && node render-poses.js /tmp/poses
// then copy fox-*/head-* into Widgets/Assets.xcassets, AppIcon.appiconset into App/Assets.xcassets, and
// fox-waiting, fox-done and fox-idle PNGs into Notify/Poses.
const fs = require('fs'), vm = require('vm'), path = require('path'), { createCanvas } = require('canvas');
const dir = path.join(__dirname, '..', '..', 'characters', 'fox') + '/';
const window = { performance: { now: () => 0 } };
const ctx = vm.createContext({ window, performance: window.performance, Math, console, Object, Array, Set, Map, JSON, Number, String, Infinity });
for (const f of ['fox.js', 'rig.js', 'character.js']) vm.runInContext(fs.readFileSync(dir + f, 'utf8'), ctx, { filename: f });
const L = window.__character, out = process.argv[2];
const frames = key => { const o = []; for (const [id, n] of L.LOOPS[key]) for (let k = 0; k < n; k++) o.push(id); return o; };
// the same wrapper the Mac player uses: scale render()'s transforms, skip its black background, soften the shadow
function draw(key, i, k) {
  const c = createCanvas(240 * k, 240 * k), raw = c.getContext('2d');
  let bg = false, fills = 0;
  const g = new Proxy(raw, {
    get(t, p) {
      if (p === 'setTransform') return (a, b, cc, d, e, f) => typeof a === 'number' ? t.setTransform(a * k, b * k, cc * k, d * k, e * k, f * k) : t.setTransform(a);
      if (p === 'resetTransform') return () => t.setTransform(k, 0, 0, k, 0, 0);
      if (p === 'fillRect') return (x, y, w, h) => { if (!bg && x === 0 && y === 0 && w === 240 && h === 240) { bg = true; return; } t.fillRect(x, y, w, h); };
      if (p === 'fill') return (...a) => { if (fills++ === 0) { const keep = t.fillStyle; t.fillStyle = 'rgba(0,0,0,.22)'; t.fill(...a); t.fillStyle = keep; return; } t.fill(...a); };
      const v = t[p]; return typeof v === 'function' ? v.bind(t) : v;
    },
    set(t, p, v) { t[p] = v; return true; }
  });
  L.render(g, null, frames(key)[i], i, { time: i / 24 }); return c;
}
// crop to what's drawn (plus a margin), square
function crop(c, box) {
  const o = createCanvas(box[2], box[3]); o.getContext('2d').drawImage(c, box[0], box[1], box[2], box[3], 0, 0, box[2], box[3]); return o;
}
function bbox(c) {
  const { data, width, height } = c.getContext('2d').getImageData(0, 0, c.width, c.height);
  let x0 = width, y0 = height, x1 = 0, y1 = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (data[(y * width + x) * 4 + 3] > 8) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const s = Math.max(x1 - x0, y1 - y0) + 8, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  return [Math.round(cx - s / 2), Math.round(cy - s / 2), s, s];
}
function save(c, name, side) {
  const o = createCanvas(side, side); o.getContext('2d').drawImage(c, 0, 0, side, side);
  const d = path.join(out, name + '.imageset'); fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, name + '.png'), o.toBuffer('image/png'));
  fs.writeFileSync(path.join(d, 'Contents.json'), JSON.stringify({ images: [{ idiom: 'universal', filename: name + '.png' }], info: { version: 1, author: 'xcode' } }, null, 2));
}
const POSES = { printing: ['working.printer', 30], working: ['working', 12], waiting: ['waiting', 6], done: ['done', 8],
                printdone: ['printdone', 8], printfail: ['printfail', 0], paused: ['printfail', 40], idle: ['idle', 0] };
for (const [name, [key, i]] of Object.entries(POSES)) {
  const big = draw(key, i, 2);
  save(crop(big, bbox(big)), 'fox-' + name, 192);
  const cx = 128 + (key.includes('print') ? 22 : 0);                   // the printer scenes sit him to the right
  save(crop(big, [(cx - 64) * 2, 16 * 2, 128 * 2, 128 * 2]), 'head-' + name, 96);
}
// the app icon: his face on warm cream, full bleed
const icon = createCanvas(1024, 1024), ig = icon.getContext('2d');
ig.fillStyle = '#FFF1DC'; ig.fillRect(0, 0, 1024, 1024);
const face = draw('awake', 0, 6);
ig.drawImage(face, 46 * 6, 4 * 6, 164 * 6, 164 * 6, 40, 70, 944, 944);
fs.mkdirSync(path.join(out, 'AppIcon.appiconset'), { recursive: true });
fs.writeFileSync(path.join(out, 'AppIcon.appiconset', 'icon.png'), icon.toBuffer('image/png'));
fs.writeFileSync(path.join(out, 'AppIcon.appiconset', 'Contents.json'), JSON.stringify({ images: [{ idiom: 'universal', platform: 'ios', size: '1024x1024', filename: 'icon.png' }], info: { version: 1, author: 'xcode' } }, null, 2));
console.log('ok');
