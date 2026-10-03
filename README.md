# Minesweeper

A browser-only arcade game built with static HTML and JavaScript. It needs no database or server runtime.

## Highway Run (3D)

The racing game is rendered in real-time 3D with [three.js](https://threejs.org) r160 (ES modules from the jsDelivr CDN):

- **Real car models** – Tesla Model 3, Porsche 911 Carrera 4S, Tesla Cybertruck, Lamborghini Urus, Ferrari 458 Spider and the Khronos GT concept are community glTF models (see [CREDITS.md](CREDITS.md)). Each car has a detailed version for the car you drive (~120k triangles max, with interior for the cockpit view) and a light version for traffic (~10k triangles, merged into a few draw calls). Wheels spin and steer, body panels dent where they are hit, and glass shatters. Pick a paint colour in the garage.
- **Vehicle physics** – every car runs a four-wheel tyre model with weight transfer, a speed-sensitive steering rack, a 6-speed gearbox (single-speed for electric cars), aerodynamic drag, and handbrake drifts. Grass, sand and snow have less grip than asphalt.
- **Difficulty & driver assists** – one slider from Easy to Realistic. Lower settings give quicker, more sensitive steering, extra grip, lighter traffic, less damage and slower police; higher settings use real grip limits and steering ratios. Traction control, ABS, stability control and steering assist follow the slider until you change one yourself.
- **Realistic crashes** – impacts are resolved with momentum, mass and spin. Body panels crumple where they are hit, bumpers and mirrors tear off, glass shatters, and damaged cars smoke or catch fire.
- **Side damage** – a hit to one side bends that side's alignment and drags its wheels. The car loses some drive power on that side and gently pulls toward it. Gas stations repair part of the damage.
- **Camera views** – Chase, Far Chase, Cockpit, Hood, Bumper, Helicopter, Top-down Classic, TV Trackside and Cinematic. Press **C** or **1–9** to switch, and hold **Q** to look back. Field of view and chase distance are adjustable in the garage.
- **Graphics** – sky with drifting clouds and stars, photo-scanned asphalt and ground textures, bloom on lights, soft shadows, and four quality levels (the game steps down automatically if the frame rate drops).
- **Five 3D maps** with their own lighting and grip: Country Roads, Neon City (night), Dust Devil Desert, Alpine Pass (snow) and Sunset Coast.

Controls: arrow keys / WASD to drive, S / ↓ to brake and reverse, Space for the handbrake, R to tow back onto the road, F for fullscreen, E for gas-station exits.

## Run locally

Serve this folder with any static web server (ES modules and the `models/` and `textures/` folders need http, not `file://`), for example `npx http-server .`, then open the printed address.

## Car model pipeline

`tools/build-cars.mjs` converts source glTF files into the game format in `models/`: metres, +X forward, wheels on the ground, roles encoded in node and material names, Draco compression, plus a light `-lod` version for traffic. See the comments at the top of the script.

## Deploy

Import this repository into Vercel with the **Other** framework preset and no build command. The site is served directly from the repository root.
