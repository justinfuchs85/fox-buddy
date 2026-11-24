# The fox

Fox Buddy's character: an original fox, drawn entirely in code by his own rig. He's under the
repository's MIT license (see `LICENSE`).

| File | What it does |
|---|---|
| `fox.js` | Drawing primitives: the gently drifting hand-drawn line (each point sways on its own slow loop) and the off-register fills |
| `rig.js` | The puppet: body, head, ears, tail (a generated, smoothly curved spine), paws and face, all poseable |
| `character.js` | His moods, transitions, fidgets, events and gags, as poses over time, plus his props and marks |

## What he does

He has 10 moods, which the bridge picks from what Claude is doing (plus a few scenes the app shows for a
while: flag, boombox, hop, and the 3D printer's printdone and printfail):

- **asleep**: dozing upright
- **night**: curled up under his own tail
- **working**: rotates through three acts, about 20 seconds each, swapping gear in a puff of smoke:
  - **accountant**: green visor, an adding machine with paper tape that spools longer and longer
  - **typewriter**: a typewriter that dings; he rips out the page, crumples it and tosses it
  - **mad scientist**: goggles and two bubbling flasks; one brew explodes, one is a eureka
  - **3D printer** (on its own, not in the rotation: for questions about the printer): a little enclosed
    printer with a spool on top, the toolhead zipping back and forth, the bed dropping a layer at a time as
    a fox-head figurine grows; chin on his paws, leaning in for the last layers, then a ding, and he lifts
    the print out, holds it up and sets it down
- **printdone**: holding the fresh print up in one paw, bouncing, sparkles
- **printfail**: spaghetti in the printer and a strand down the front; paws to his cheeks, then a facepalm
- **long haul**: the same three acts, frazzled, with the mess piling up (tape on the floor, a heap
  of paper balls, singed fur) and a growing stack of coffee cups
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

He's silent: his gags never ask the bridge for a sound, and Fox Buddy ships no sounds.

## Adding to him

A drawing is just a pose, for example:

```js
{ eyes: 'happy', mouth: 'open', armR: [176, 92], tail: 0.3 }
```

See the top of `rig.js` for every setting. A gag is a list of `[ticks, pose]` beats in `GAG`, in
`character.js`, at 24 ticks a second. Every beat eases into the next (`smooth()`), so you only write the
key poses: there's a fresh drawing every tick. Re-run `zsh tools/foxbuddy/build.sh` after changing anything.
