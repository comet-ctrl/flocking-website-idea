# Red Arrow — a flocking website idea

A personal website concept: silver birds move across a dark background, while your mouse becomes a glowing red intruder. Each bird responds to nearby birds and the pointer.

**[Play the prototype](https://comet-ctrl.github.io/flocking-website-idea/)**

This repository contains the working interaction prototype and a direction for turning it into a personal portfolio. It is an independent interpretation of the reference, not the original video's code or a pixel-perfect recreation.

## The website idea

Use the flock as the living background of a personal homepage. Place a short introduction, selected projects, and contact links above the canvas. Visitors can disturb the flock without navigating away; it becomes a memorable part of the site's identity.

The current prototype is a full-screen playground. A portfolio version should keep text in calm, readable areas, retain ordinary cursors over links and controls, and provide a visible pause option. Touch input, reduced-motion preferences, and lower-powered devices should remain first-class considerations.

## How it works

Every bird stores its position, velocity, and its own turning momentum. The browser repeats a simulation step and redraws the scene using `requestAnimationFrame`.

1. **Find neighbors.** A spatial grid finds each bird's seven closest neighbors within 64 pixels. Distances are ordinary screen distances: opposite edges are not connected.
2. **Separate.** Birds steer away from neighbors that are too close, leaving space within the dense flock.
3. **Pass turns to neighbors.** A bird keeps turning momentum instead of immediately averaging its direction into the group. Nearby birds exchange small turning forces: if either bird chooses the other among its seven closest neighbors, they form a local link. Each link applies equal and opposite forces, with a smaller weight where birds have more links. A bend can therefore travel from bird to bird without applying one shared turn to the whole flock. Gentle damping smooths the motion, and tiny independent, slowly changing fluctuations keep flight from settling into a rigid translation.
4. **Turn toward nearby birds.** Cohesion considers birds within 300 pixels, a wider neighborhood than the seven closest birds. Attraction fades smoothly with distance. Most of its effect turns a bird toward its neighbors; only a small portion changes forward speed. This avoids strongly braking the front and accelerating the back until a long flock compresses into a ball. Some speed response remains so separated birds can catch up. The steering follows each bird's own heading, with no assigned world direction or flight path.
5. **Avoid the intruder.** The arrow's smoothed velocity extends its danger zone up to 0.22 seconds ahead, with a distance cap to keep sudden mouse jumps local. Birds are repelled from the nearest point on this predicted path. No left or right side is assigned. Holding the pointer makes the danger zone larger and repulsion stronger.
6. **Move with inertia.** Acceleration changes gradually and has a limit. Self-propulsion nudges birds toward a cruising speed, while avoidance can slow a bird facing the intruder head-on. A maximum speed prevents runaway acceleration.
7. **Stay inside the screen.** The visible canvas is the entire world. Birds anticipate an approaching edge and bank back into the available space; nearby birds carry that turn through the flock. Close to an edge, only outward speed eases down to leave time for the turn, while flight along the edge remains free. There is no wrapping, camera panning, zooming, or hidden flight area. Pointer and bird positions use the same screen coordinates. Each bird is drawn as a short silver stroke oriented along its velocity.

Conceptually:

```text
turning momentum += local heading differences + neighboring turning momentum
                  - damping + small independent fluctuations

steering = separation + cohesion as turning and gentle catch-up
         + intruder repulsion + self-propulsion
turning momentum += local anticipation of an approaching screen edge

acceleration = ease(previous acceleration, steering)
velocity = rotate(velocity, turning momentum * elapsed time)
velocity = limit speed(velocity + acceleration * elapsed time)
turning momentum += a small part of the turn caused by local steering
position = position + velocity * elapsed time
position = stay within the visible screen boundary
```

Flock shapes and openings around the mouse come from the local rules, without a target formation, shared bank, assigned bypass curve, or whole-flock centering force. Wider social contact supports one flock. Edge avoidance is local to birds approaching a boundary; it does not assign the whole group a circular route. A final boundary constraint prevents escape even during strong mouse disturbances. Birds never disappear into an offscreen world or reappear at the opposite edge.

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

Neighbor search uses a spatial grid, searches nearby cells first, and skips cells that cannot contain a closer candidate. It finds the actual seven nearest neighbors within 64 pixels and stops at the screen edges. Cohesion uses a wider, finite perception range. Reused typed arrays reduce temporary allocations.

The closest-neighbor lists and their turning links refresh every three physics steps; the broader cohesion calculation refreshes every six. Turning links and work buffers are reused typed arrays. Each pair is processed once per step. Coarse-cell summaries compute the same weighted attraction without scanning every bird in fully covered cells. Steering and mouse avoidance are recalculated every step. The background gradient is cached, and hidden tabs skip animation work. These reduce overhead without reducing the flock population.

Rendering interpolates between the last two physics poses, adding at most one physics step of visual delay. Silver particles share four brightness/thickness groups, reducing their body drawing to four strokes per frame. Three faint trail strokes show approximately 30 milliseconds of position history without accumulating a blurred canvas. At a constant speed setting, trail duration is independent of display refresh rate.

Density develops from local separation and cohesion. There is no minimum connected percentage, recovery quota, target silhouette, or forced two-stream split.

## Run locally

No dependencies, backend, API keys, or build step are needed. Open `index.html` in a browser, or serve this directory with any static web server:

```sh
python -m http.server 8000
```

Then visit `http://localhost:8000`.

Run the simulation regression checks with:

```sh
node --test tests/flock.cjs tests/neighbors.cjs
```

The checks cover exact neighbor selection and cohesion, screen boundaries, fixed-step timing, local interaction, and simulation stability. A matched-control experiment turns birds at just one end of a long group, then checks that the change arrives later in more distant birds and retains a meaningful strength. The checks do not require a particular flock silhouette or split. Visual comparison is still needed to judge resemblance to the reference.

## Files

- `index.html`: page layout, styling, canvas, and controls.
- `app.js`: animation loop, drawing, cursor trail, pointer input, and UI.
- `flock.js`: local flocking, intruder repulsion, flight inertia, and screen-edge avoidance.
- `neighbors.js`: optimized nearest-neighbor search inside the visible screen.
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
- [Cavagna et al.: Flocking and turning — an inertial-spin model](https://arxiv.org/abs/1403.1202), inspiration for local turning momentum and propagation; this prototype is an artistic adaptation.
- [Daniel Lengyel: flocking integrated into a personal homepage](https://daniellengyel.github.io/).
- [Chamu: boids as a personal-site background](https://chamu.io/projects/boids-background/).
- [Steve's Site: interactive murmuration](https://stevessite.com/murmuration.html).

External examples are references only. Their code, video footage, screenshots, and other assets are not included in this repository.
