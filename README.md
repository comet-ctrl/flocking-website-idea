# Red Arrow — a flocking website idea

A personal website concept: a dense silver flock moves across a dark background, while your mouse becomes a glowing red intruder. The birds part around it, bank together, and regroup.

**[Play the prototype](https://comet-ctrl.github.io/flocking-website-idea/)**

This repository contains the working interaction prototype and a direction for turning it into a personal portfolio. It is an independent interpretation of the reference, not the original video's code or a pixel-perfect recreation.

## The website idea

Use the flock as the living background of a personal homepage. Place a short introduction, selected projects, and contact links above the canvas. Visitors can disturb the flock without navigating away; it becomes a memorable part of the site's identity.

The current prototype is a full-screen playground. A portfolio version should keep text in calm, readable areas, retain ordinary cursors over links and controls, and provide a visible pause option. Touch input, reduced-motion preferences, and lower-powered devices should remain first-class considerations.

## How it works

Every bird stores its position and velocity. The browser repeats a simulation step and redraws the scene using `requestAnimationFrame`.

1. **Find neighbors.** A spatial grid narrows the search to nearby cells. Each bird chooses up to seven closest neighbors within the local search radius.
2. **Separate.** Birds steer away from neighbors that are too close, leaving space within the dense flock.
3. **Align.** Birds gradually match their neighbors' velocities, making turns spread through the group.
4. **Stay together.** Local cohesion draws birds toward their neighbors. A gentle whole-flock centering and alignment term helps disconnected pieces regroup.
5. **Anticipate the intruder.** The arrow's smoothed velocity extends its danger zone up to 0.22 seconds ahead, with a distance cap to keep sudden mouse jumps local. Nearby birds turn away using their neighbors' direction of flight, so each part of the flock can respond locally. Each bird remembers its chosen side until it has been clear of danger for 0.45 simulation seconds, reducing left/right jitter. Holding the pointer widens the opening. The forward extension fades as the arrow stops.
6. **Smooth the turn.** Steering acceleration is eased, speed changes gradually, and angular changes are limited. Early look-ahead starts a gentle group bank near the viewport edges. Individual birds take the shorter turn toward the interior, rather than being forced to turn to the same side at an edge.
7. **Draw.** Each bird is a short silver stroke oriented along its velocity. The normal canvas cursor is hidden; a separate glowing red arrow and fading trail follow the pointer.

Conceptually:

```text
steering = separation + neighbor alignment + local cohesion
         + gentle group cohesion + edge banking + local mouse avoidance

acceleration = ease(previous acceleration, steering)
velocity = turn gradually toward velocity + acceleration
position = position + velocity * elapsed time
```

The current movement restores the earlier local flocking foundation from commit `1252c60`, with improved edge turns and the faster neighbor search. Turns and splits develop through separation, alignment, and cohesion. The density envelope, shared Gaussian bypass curve, and following camera have been removed. The view stays fixed, so the flock visibly travels across the screen.

This is an artistic boids-style model, not a scientifically exact starling simulation or a claim about the reference video's algorithm. Birds have no assigned tracks or positions. The prototype renders roughly 1,100–3,200 birds depending on viewport area. Performance depends on the device and flock density; there is no fixed frame-rate guarantee.

## Controls

| Input | Action |
| --- | --- |
| Move mouse / drag a finger | Act as the red intruder |
| Hold mouse button / touch | Stronger avoidance |
| Speed | Choose 1×, 1.5×, 1.8×, or 2.2× (default) |
| Demo intruder | Let the arrow move automatically when the pointer is outside the canvas |
| Space or Pause | Pause/resume the simulation |
| H | Hide/show the interface |
| Reset | Recreate the flock |
| Fullscreen | Enter/exit fullscreen where supported |

The animation starts paused when the browser reports a reduced-motion preference. The user can explicitly resume it.

## Speed and performance

The default is **2.2×**: about **277 CSS pixels per second** in calm flight, compared with about 126 at 1×. The fixed view makes this forward movement visible. This is a visual tuning choice, not an exact measurement of the reference video's particles. Use 1.8× for the previous pace, or 1.5× for a calmer background.

The speed control advances the whole simulation faster, preserving the relationship between flight, turning, and avoidance. Physics runs in fixed 1/60-second steps, so ordinary 30, 60, and 120 Hz rendering follows the same simulation timing. Long stalls are capped to avoid excessive catch-up work.

Neighbor search uses 16-pixel cells, searches nearby cells first, and skips cells that cannot contain a closer candidate. Each bird still gets its actual seven nearest neighbors within 64 pixels. Birds with fewer than four nearby neighbors extend their search to 160 pixels to reconnect with the flock. This reduces search work without approximating the selected neighbors or reducing the population.

Neighbor lists are refreshed every three physics steps, while steering and mouse avoidance are recalculated every step. The background gradient is cached, and hidden tabs skip animation work. These reduce overhead without reducing the flock population.

Rendering interpolates between the last two physics poses, adding at most one physics step of visual delay. Silver particles share four brightness/thickness groups, reducing their body drawing to four strokes per frame. Three faint trail strokes show approximately 30 milliseconds of position history without accumulating a blurred canvas. At a constant speed setting, trail duration is independent of display refresh rate.

Density comes from closer local spacing: the separation comfort distance is 7.8 pixels, with stronger cohesion across each stream and gentler compression along its length. This keeps the body fuller while leaving room for turns and splits. Alignment, banking, angular limits, and whole-flock attraction retain the natural movement settings.

The extra escape-speed burst near the mouse is smaller, helping startled birds stay with their stream. Calm flight and the default 2.2× pace are unchanged. Particle count, the optimized neighbor search, and physics frequency are unchanged.

After an encounter, whole-flock attraction eases back over time while local alignment keeps each stream organized. A few natural stragglers are allowed; birds are not pulled back onto a prescribed ribbon.

## Run locally

No dependencies, backend, API keys, or build step are needed. Open `index.html` in a browser, or serve this directory with any static web server:

```sh
python -m http.server 8000
```

Then visit `http://localhost:8000`.

Run the simulation regression checks with `node --test tests/flock.cjs`.

The checks compare the optimized nearest-seven search with an exhaustive all-pairs search in sparse and dense flocks, including distance ties and cell boundaries. They also verify matching simulation results at 30, 60, and 120 Hz at both 1.8× and 2.2×, local mouse response, anticipation, interpolation, and stable travel and banking in wide and narrow viewports.

The density criterion for the standard mouse-pass scenario at 2.2× is that at least 99% of birds retain three or more neighbors within 40 pixels. Additional seeded recovery checks require over 90% of birds to rejoin one connected group after the mouse passes. These checks allow a few natural stragglers and catch simulation regressions; visual comparison is still needed to judge whether the movement resembles the reference.

## Files

- `index.html`: page layout, styling, canvas, and controls.
- `app.js`: animation loop, drawing, cursor trail, pointer input, and UI.
- `flock.js`: spatial neighbor lookup, flocking behavior, avoidance, and smooth steering.
- `.nojekyll`: serves the repository as plain static files on GitHub Pages.

## Portfolio integration

Keep the simulation behind semantic HTML rather than rendering the site's content into the canvas. Let foreground links and buttons keep normal pointer behavior, and consider reducing the bird count on mobile. Hidden-tab pausing is already implemented; the portfolio layout and mobile population tuning remain integration ideas.

Possible next steps:

- Add an introduction and selected-project cards with stable contrast.
- Add a quality selector and optional performance-based population adjustment.
- Offer a static illustration for visitors who prefer no animation.
- Add an optional monochrome theme that matches the rest of the portfolio.

## Inspiration and references

- [Original visual reference: 《涌现 · 无人指挥》 on Bilibili](https://www.bilibili.com/video/BV1CKa16mE83/).
- [Craig Reynolds: Boids](https://www.red3d.com/cwr/boids/).
- [Daniel Lengyel: flocking integrated into a personal homepage](https://daniellengyel.github.io/).
- [Chamu: boids as a personal-site background](https://chamu.io/projects/boids-background/).
- [Steve's Site: interactive murmuration](https://stevessite.com/murmuration.html).

External examples are references only. Their code, video footage, screenshots, and other assets are not included in this repository.
