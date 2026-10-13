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
5. **Anticipate the intruder.** The arrow's smoothed velocity extends its danger zone up to 0.22 seconds ahead, with a distance cap to keep sudden mouse jumps local. Birds use the same slowly changing flock orientation to choose two sides. A curved bypass steers their velocity outward before the obstacle and inward after it, preserving forward flight instead of ejecting them radially. Each bird remembers its chosen side until it has been clear of danger for 0.45 simulation seconds, reducing left/right jitter. Holding the pointer widens the opening. The forward extension fades as the arrow stops.
6. **Smooth the turn.** Steering acceleration is eased, speed changes gradually, and angular changes are limited. A slowly varying shared bank initiates broad turns in open space.
7. **Draw.** Each bird is a short silver stroke oriented along its velocity. The normal canvas cursor is hidden; a separate glowing red arrow and fading trail follow the pointer.

Conceptually:

```text
steering = separation + neighbor alignment + local cohesion
         + gentle group cohesion + density shaping + shared banking + mouse avoidance

acceleration = ease(previous acceleration, steering)
velocity = turn gradually toward velocity + acceleration
position = position + velocity * elapsed time
```

This is an artistic boids-style model, not a scientifically exact starling simulation. A soft density envelope maintains an elongated body and gently bends it; these are explicit artistic forces layered on local flocking, not claims about the original video algorithm. Birds have no assigned tracks or positions. A following camera replaces screen walls. At normal settings, the prototype renders roughly 1,100–3,200 birds depending on viewport area. Performance depends on the device and flock density; there is no fixed frame-rate guarantee.

## Controls

| Input | Action |
| --- | --- |
| Move mouse / drag a finger | Act as the red intruder |
| Hold mouse button / touch | Stronger avoidance |
| Speed | Choose 1×, 1.5×, 1.8× (default), or 2.2× |
| Demo intruder | Let the arrow move automatically when the pointer is outside the canvas |
| Space or Pause | Pause/resume the simulation |
| H | Hide/show the interface |
| Reset | Recreate the flock |
| Fullscreen | Enter/exit fullscreen where supported |

The animation starts paused when the browser reports a reduced-motion preference. The user can explicitly resume it.

## Speed and performance

The recommended default is **1.8×**: about **227 world-space pixels per second** in calm flight, compared with the old 126. Apparent screen movement also depends on the following camera. This is a visual tuning choice after reviewing the reference at normal playback speed, not an exact measurement of its particles. Try 1.5× for a calmer background or 2.2× for a more energetic effect.

The speed control advances the whole simulation faster, preserving the relationship between flight, turning, and avoidance. Physics runs in fixed 1/60-second steps, so ordinary 30, 60, and 120 Hz rendering follows the same simulation timing. Long stalls are capped to avoid excessive catch-up work.

Neighbor lists are refreshed every three physics steps, while steering and mouse avoidance are recalculated every step. The background gradient is cached, and hidden tabs skip animation work. These reduce overhead without reducing the flock population.

Rendering interpolates between the last two physics poses, adding at most one physics step of visual delay. Silver particles share four brightness/thickness groups, reducing their body drawing to four strokes per frame. Three faint trail strokes show approximately 30 milliseconds of position history without accumulating a blurred canvas. At a constant speed setting, trail duration is independent of display refresh rate.

After an encounter, whole-flock attraction eases back over time while local alignment keeps each stream organized. A gently following camera keeps the group in view without wall-driven loops. The default pace remains 1.8×.

Formation tuning strengthens local heading agreement and reduces compression along each stream's length. Birds with fewer than four neighbors extend their search to 160 pixels to reconnect with nearby groups. During a scare, global attraction now retains at least 65% of its normal strength; sideways avoidance is gentler. The body starts wider, and density pressure resists collapse into a compact knot while allowing local splitting. Shorter, brighter marks and subdued trails keep individual particles readable.

Loose tips outside the main body's length or width receive a gradual inward correction and stronger heading alignment. Sparse or frightened birds are excluded from outward length expansion. The intruder's extra speed boost is reduced to limit birds racing ahead of their stream. These changes reduce offshoots without hiding or deleting birds.

This tuning was visually compared before publication using a 1280×720 preview and the reference video's 640×360 source (both 16:9), including a single pointer sweep. The video was played at normal speed; the site stayed at 1.8×. It is a qualitative comparison, not a frame-by-frame reproduction.

## Run locally

No dependencies, backend, API keys, or build step are needed. Open `index.html` in a browser, or serve this directory with any static web server:

```sh
python -m http.server 8000
```

Then visit `http://localhost:8000`.

Run the simulation regression checks with `node --test tests/flock.cjs`.

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
