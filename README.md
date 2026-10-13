# Red Arrow — a flocking website idea

A personal website concept: silver birds move across a dark background, while your mouse becomes a glowing red intruder. Each bird responds to nearby birds and the pointer.

**[Play the prototype](https://comet-ctrl.github.io/flocking-website-idea/)**

This repository contains the working interaction prototype and a direction for turning it into a personal portfolio. It is an independent interpretation of the reference, not the original video's code or a pixel-perfect recreation.

## The website idea

Use the flock as the living background of a personal homepage. Place a short introduction, selected projects, and contact links above the canvas. Visitors can disturb the flock without navigating away; it becomes a memorable part of the site's identity.

The current prototype is a full-screen playground. A portfolio version should keep text in calm, readable areas, retain ordinary cursors over links and controls, and provide a visible pause option. Touch input, reduced-motion preferences, and lower-powered devices should remain first-class considerations.

## How it works

Every bird stores its position and velocity. The browser repeats a simulation step and redraws the scene using `requestAnimationFrame`.

1. **Find neighbors.** A spatial grid finds each bird's seven closest neighbors within 64 pixels. Distances continue across opposite screen edges.
2. **Separate.** Birds steer away from neighbors that are too close, leaving space within the dense flock.
3. **Align.** Birds gradually match their neighbors' velocities, making turns spread through the group.
4. **Stay together locally.** Cohesion considers birds within 300 pixels, a wider neighborhood than the seven closest birds. This keeps contact across the flock instead of letting each small clump behave independently. Gentle attraction fades smoothly with distance and uses the same rule in every direction.
5. **Avoid the intruder.** The arrow's smoothed velocity extends its danger zone up to 0.22 seconds ahead, with a distance cap to keep sudden mouse jumps local. Birds are repelled from the nearest point on this predicted path. No left or right side is assigned. Holding the pointer makes the danger zone larger and repulsion stronger.
6. **Move with inertia.** Acceleration changes gradually and has a limit. Self-propulsion nudges birds toward a cruising speed, while avoidance can slow a bird facing the intruder head-on. A maximum speed prevents runaway acceleration.
7. **Keep the flock in view.** Each bird is a short silver stroke oriented along its velocity. The view gently follows the flock, displaying birds continuously across the repeating world's seams. This camera movement does not affect flight or steering. Pointer coordinates are translated into the same world so the red arrow still interacts with the birds beneath it.

Conceptually:

```text
steering = separation + neighbor alignment + local cohesion
         + intruder repulsion + self-propulsion

acceleration = ease(previous acceleration, steering)
velocity = limit speed(velocity + acceleration * elapsed time)
position = position + velocity * elapsed time
position = wrap across opposite edges
```

Flock shapes and openings around the mouse come from the local rules, without a target formation, shared bank, assigned bypass curve, or whole-flock centering force. Wider social contact supports one flock, while the following view prevents a screen edge from displaying it as two distant groups. The repeating world removes the need for boundary steering. Strong sustained disturbance can still separate birds beyond their finite perception range; they are never teleported back or assigned a regrouping path.

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

The default is **2.2×**. The cruising target corresponds to about **277 CSS pixels per second**, compared with about 126 at 1×; steering and avoidance can change a bird's actual speed. This is a visual tuning choice, not an exact measurement of the reference video's particles. Use 1.8× or 1.5× for a calmer background.

The speed control advances the whole simulation faster, preserving the relationship between flight, turning, and avoidance. Physics runs in fixed 1/60-second steps, so ordinary 30, 60, and 120 Hz rendering follows the same simulation timing. Long stalls are capped to avoid excessive catch-up work.

Neighbor search uses a spatial grid, searches nearby cells first, and skips cells that cannot contain a closer candidate. It finds the actual seven nearest neighbors within 64 pixels, including across wrapped edges. Cohesion uses a wider, finite perception range. Reused typed arrays reduce temporary allocations.

The closest-neighbor lists refresh every three physics steps; the broader cohesion calculation refreshes every six. Coarse-cell summaries compute the same weighted attraction without scanning every bird in fully covered cells. Steering and mouse avoidance are recalculated every step. The background gradient is cached, and hidden tabs skip animation work. These reduce overhead without reducing the flock population.

Rendering interpolates between the last two physics poses, adding at most one physics step of visual delay. Silver particles share four brightness/thickness groups, reducing their body drawing to four strokes per frame. Three faint trail strokes show approximately 30 milliseconds of position history without accumulating a blurred canvas. At a constant speed setting, trail duration is independent of display refresh rate.

Density develops from local separation and cohesion. There is no minimum connected percentage, recovery quota, directional compression, or forced two-stream split.

## Run locally

No dependencies, backend, API keys, or build step are needed. Open `index.html` in a browser, or serve this directory with any static web server:

```sh
python -m http.server 8000
```

Then visit `http://localhost:8000`.

Run the simulation regression checks with:

```sh
node --test tests/flock.cjs tests/neighbors.cjs tests/view.cjs
```

The checks cover exact neighbor selection and cohesion, wrapped distances, fixed-step timing, local interaction, simulation stability, and camera/pointer mapping. They do not require a particular flock silhouette or split. Visual comparison is still needed to judge resemblance to the reference.

## Files

- `index.html`: page layout, styling, canvas, and controls.
- `app.js`: animation loop, drawing, cursor trail, pointer input, and UI.
- `flock.js`: local flocking, intruder repulsion, flight inertia, and edge wrapping.
- `neighbors.js`: optimized nearest-neighbor search in the repeating viewport.
- `view.js`: camera following and screen/world coordinate conversion; no bird steering.
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
