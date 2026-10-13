# Red Arrow — a flocking website idea

Silver birds form a living background, and your mouse becomes a glowing red intruder.

**[Play the website](https://comet-ctrl.github.io/flocking-website-idea/)**

This is an independent interpretation of [《涌现 · 无人指挥》](https://www.bilibili.com/video/BV1CKa16mE83/), not the original video's code or an exact reconstruction of its simulation.

## How the flock works

Each bird has a position, velocity, and turning momentum in three dimensions. You see a fixed, flat projection of that small volume. Its horizontal and vertical limits are exactly the screen; depth lets birds pass above or below each other and form overlapping folds. There is no scrolling, camera movement, zoom, wrapping, or hidden flight area beyond the screen edges.

The flock follows local rules:

1. **Leave room.** A bird moves away from its closest neighbors when they come within 28 world units. Slightly closer personal spacing makes the flock denser while retaining room for birds occupying a volume rather than a flat plane.
2. **Pass turns along.** A spatial grid finds the seven closest birds within 120 units in 3D. Nearby birds exchange equal and opposite turning forces. Each bird retains its own angular momentum, so a bend can travel through the flock instead of rotating everyone together. Stronger sharing of turning momentum and gentler heading agreement allow neighboring sections to enter a bend at different times.
3. **Stay with the nearby flock.** Birds within 300 units attract one another, with influence fading to zero at that distance. Attraction mainly steers the bird; 35% of its component along the bird's forward direction remains for speed adjustment. This modest catch-up response reduces sparse tails without increasing the inward steering that can tighten bends.
4. **React to the intruder.** Mouse velocity extends the arrow's danger zone up to 0.2 seconds ahead, with a distance cap. Birds are repelled from the nearest point on that predicted path, through the entire depth of the flock. The stronger mouse response is retained, including the extra acceleration allowance for a close encounter. No left/right side or number of streams is assigned. Holding the pointer increases avoidance.
5. **Fly with inertia.** Acceleration eases toward its target. Turning momentum relaxes between nudges, with a modest limit on the stored rotation to reduce lingering tight curls. Small independent fluctuations allow local variation. Self-propulsion maintains a cruising speed; a head-on threat can slow a bird down.
6. **See the boundaries ahead.** Birds anticipate the screen edges and the front/back of the depth volume. Close to a boundary, outward velocity eases down; a final guard keeps every position inside. There is no prescribed circuit around the screen.

The model has no flock-wide heading, target silhouette, assigned route, fixed split, or recovery quota. One population starts together; its changing shape and response come from these local interactions. Strong disturbances can temporarily separate parts of the flock. It is an artistic flocking model, not a scientifically validated starling simulation or a claim about the reference video's algorithm.

## Speed, drawing, and performance

The speed is fixed at **2.2×**. The simulation runs in fixed 1/60-second steps. The cruising target is about 277 world units per real second at 2.2×. Apparent screen speed varies with depth motion, turns, and avoidance. Long stalls and queued work are capped to prevent excessive catch-up work. On devices that cannot keep up, simulation time is dropped rather than allowing an ever-growing input delay.

The population is capped at 1,100–2,200 birds according to viewport area. Neighbor lists and their angular links refresh every three physics steps. Each bird's cohesion refreshes every six steps, spread across six interleaved groups to reduce frame-time spikes. A separate coarse 3D grid calculates exact distance-weighted attraction from cell summaries; only cells intersecting the perception boundary need individual bird checks. Typed arrays and cached cell centers reduce allocations and repeated arithmetic.

On a served website, a Web Worker runs the physics separately from mouse handling and drawing. It transfers compact position snapshots instead of copying every simulation object. Drawing samples actual position history with a ten-tick buffer (about 76 milliseconds at 2.2×), smoothing the gaps between updates without inventing future turns. The arrow itself responds immediately. Browsers without worker support, and files opened directly, use the same physics on the main thread.

Each bird is a tapered silver stroke with a fine white tip, stable brightness variation, and a depth-dependent length. Poses are calculated once and reused for batched drawing. A quarter-resolution light layer adds a soft halo without per-bird shadow blur, and a faint wake follows actual position history. The arrow has a thin fading shaft and a short trail whose lifetime is measured in seconds. The background gradient is cached, and hidden tabs stop requesting simulation time.

Performance depends on device, density, and viewport size; this is not a guarantee of 60 FPS.

## Controls

| Input | Action |
| --- | --- |
| Move mouse / drag a finger | Move the red intruder |
| Hold mouse / touch | Stronger avoidance |
| Space | Pause/resume |

The canvas fills the viewport with no on-screen buttons or panels. It can receive keyboard focus with Tab. The animation starts paused if the browser reports a reduced-motion preference; press Space to start it.

## Permanent visual details

Two visual details are always present over the silver rendering:

- **Red light spill:** nearby birds pick up a rose tint that fades with distance from the arrow.
- **Subtle wing shapes:** a fixed subset of nearby birds gains tiny curved wings, drawn in one batch.

These details change only the drawing. They do not alter positions, flock rules, bird count, or the fixed 2.2× speed. There are no experimental effect settings or saved visual preferences.

## The website idea

Use the flock behind a personal homepage with a short introduction, selected projects, and contact links. Keep those elements as semantic HTML above the canvas, with readable contrast and ordinary cursors on interactive controls. Visitors can disturb the background while exploring the portfolio.

This repository contains the full-screen interaction prototype. Portfolio content, a quality selector, and a static alternative are possible future additions.

## Files and local use

- `index.html`: viewport layout, styles, and accessible canvas.
- `app.js`: drawing, interpolation, pointer and keyboard input, and animation timing.
- `flock.js`: bird physics, 3D neighbor searches, local attraction, and boundary handling.
- `flock-runner.js`: worker scheduling, rendering snapshots, and the synchronous fallback.
- `flock-worker.js`: runs the same physics away from the browser's main thread.
- `.nojekyll`: tells GitHub Pages to serve plain static files.
- `tests/`: checks the physical rules and spatial calculations.

There are no runtime dependencies, API keys, backend, or build step. Open `index.html` or use a static server:

```sh
python -m http.server 8000
```

Run the regression checks with:

```sh
node --test tests/*.cjs
```

The checks cover exact 3D neighbors and attraction against exhaustive calculations, fixed-step timing at different refresh rates, local influence, mouse anticipation, smooth avoidance falloff and release, finite screen/depth bounds, continuous history, delayed turn propagation, and worker transfer/timing behavior. The turn experiment uses a localized 17-degree heading change in an approximately 900-unit-long group at uncompressed personal spacing, and checks that the response arrives later farther away without losing its strength. Visual comparison is still required to judge resemblance.

## References

- [Original visual reference on Bilibili](https://www.bilibili.com/video/BV1CKa16mE83/).
- [Craig Reynolds: Boids](https://www.red3d.com/cwr/boids/).
- [Cavagna et al.: an inertial-spin model of flocking and turning](https://arxiv.org/abs/1403.1202), inspiration for local turning momentum; this is an artistic adaptation.
- [Daniel Lengyel's personal homepage](https://daniellengyel.github.io/).
- [Chamu's boids background](https://chamu.io/projects/boids-background/).
- [Steve's interactive murmuration](https://stevessite.com/murmuration.html).

External examples are references only. Their footage, source code, and other assets are not included in this repository.
