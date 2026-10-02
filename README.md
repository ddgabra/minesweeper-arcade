# Minesweeper

A browser-only arcade game built with static HTML and JavaScript. It needs no database or server runtime.

## Highway Run (3D)

The racing game is rendered in real-time 3D with [three.js](https://threejs.org) (loaded from the jsDelivr CDN):

- **Vehicle physics** – every car runs a four-wheel tyre model with weight transfer, a speed-sensitive steering rack, a 6-speed gearbox, aerodynamic drag, and handbrake drifts. Grass, sand and snow have less grip than asphalt.
- **Realistic crashes** – impacts are resolved with momentum, mass and spin. Body panels crumple where they are hit, bumpers and mirrors tear off, glass shatters, and damaged cars smoke or catch fire.
- **Side damage** – a hit to one side bends that side's alignment and drags its wheels. The car loses some drive power on that side and gently pulls toward it. Gas stations repair part of the damage.
- **Camera views** – Chase, Far Chase, Cockpit (with a working steering wheel), Hood, Bumper, Helicopter, Top-down Classic and TV Trackside. Press **C** or **1–8** to switch, and hold **Q** to look back.
- **Five 3D maps** with their own lighting and grip: Country Roads, Neon City (night), Dust Devil Desert, Alpine Pass (snow) and Sunset Coast.

Controls: arrow keys / WASD to drive, S / ↓ to brake and reverse, Space for the handbrake, R to tow back onto the road, F for fullscreen, E for gas-station exits.

## Run locally

Keep `index.html` and `highway.js` together and open `index.html` in a modern browser, or serve this folder with any static web server.

## Deploy

Import this repository into Vercel with the **Other** framework preset and no build command. The site is served directly from the repository root.
