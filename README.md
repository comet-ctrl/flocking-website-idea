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
5. **Avoid the intruder.** Nearby birds receive a radial push plus a sideways push relative to the flock's average heading. Birds on opposite sides peel apart, opening a gap around the mouse. Holding the pointer increases the effect.
6. **Smooth the turn.** Steering acceleration is eased, speed changes gradually, and angular changes are limited. Predictive boundary steering starts a bank before the flock hits the screen edge.
7. **Draw.** Each bird is a short silver stroke oriented along its velocity. The normal canvas cursor is hidden; a separate glowing red arrow and fading trail follow the pointer.

Conceptually:

```text
steering = separation + neighbor alignment + local cohesion
         + gentle group cohesion + boundary steering + mouse avoidance

acceleration = ease(previous acceleration, steering)
velocity = turn gradually toward velocity + acceleration
position = position + velocity * elapsed time
```

This is an artistic boids-style model, not a scientifically exact starling simulation. Group-level guidance and a finite neighbor radius are deliberate choices to keep the flock together on a bounded screen. At normal settings, the prototype renders roughly 850–2,400 birds depending on viewport area. Performance depends on the device and flock density; there is no fixed frame-rate guarantee.

## Controls

| Input | Action |
| --- | --- |
| Move mouse / drag a finger | Act as the red intruder |
| Hold mouse button / touch | Stronger avoidance |
| Demo intruder | Let the arrow move automatically when the pointer is outside the canvas |
| Space or Pause | Pause/resume the simulation |
| H | Hide/show the interface |
| Reset | Recreate the flock |
| Fullscreen | Enter/exit fullscreen where supported |

The animation starts paused when the browser reports a reduced-motion preference. The user can explicitly resume it.

## Run locally

No dependencies, backend, API keys, or build step are needed. Open `index.html` in a browser, or serve this directory with any static web server:

```sh
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## Files

- `index.html`: page layout, styling, canvas, and controls.
- `app.js`: animation loop, drawing, cursor trail, pointer input, and UI.
- `flock.js`: spatial neighbor lookup, flocking behavior, avoidance, and smooth steering.
- `.nojekyll`: serves the repository as plain static files on GitHub Pages.

## Portfolio integration

Keep the simulation behind semantic HTML rather than rendering the site's content into the canvas. Let foreground links and buttons keep normal pointer behavior. Pause the animation when the page is hidden, and consider reducing the bird count on mobile. These are integration ideas, not completed features of this prototype.

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
