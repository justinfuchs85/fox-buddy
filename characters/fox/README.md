# The fox

An original character for Desktop Lump. Pick him with right-click → **Character → Fox**.

He's drawn entirely in code by his own rig. None of Lump's drawings, animations, sounds or drawing
code is used, so he isn't covered by Lump's art license (`LICENSE-ART.md`). He belongs to whoever
commissioned him, and they choose his license.

| File | What it does |
|---|---|
| `fox.js` | Drawing primitives: the gently drifting hand-drawn line (each point sways on its own slow loop) and the off-register fills |
| `rig.js` | The puppet: body, head, ears, tail (a generated, smoothly curved spine), paws and face, all poseable |
| `character.js` | His moods, transitions, fidgets, events and gags, as poses over time, plus his props and marks |

## What he does

He has the same 10 moods as Lump, so the bridge drives him unchanged:

- **asleep**: dozing upright
- **night**: curled up under his own tail
- **working**: typing on a laptop
- **long haul**: tired and sweating
- **needs you**: waving
- **waiting too long**: both paws, worried
- **done**: jumping for joy
- **meeting**: holding a ringing clock
- **awake**: looking around
- **VIP letter**: holding an envelope

Moods are linked by 90 direct transitions (every mood to every other).

His events are the three fidgets, hello and oops, and 14 tap gags that each play from any daytime
mood: pounce, tail chase, sneeze, howl, zoomies, hiccup, leaf, boop, yawn, peekaboo, disco, floss, dab
and dubstep. At
night he only gives a grumpy one-eyed startle, and before meetings he checks his clock.

He's silent: his gags never ask the bridge for a sound (it only has Lump's). The bridge's mood chimes
are a bridge setting: `curl -X POST 127.0.0.1:47823/sound -d off` turns them off.

## Adding to him

A drawing is just a pose, for example:

```js
{ eyes: 'happy', mouth: 'open', armR: [176, 92], tail: 0.3 }
```

See the top of `rig.js` for every setting. A gag is a list of `[ticks, pose]` beats in `GAG`, in
`character.js`, at 24 ticks a second. Every beat eases into the next (`smooth()`), so you only write the
key poses: there's a fresh drawing every tick. Re-run `zsh tools/desklump/build.sh` after changing anything.
