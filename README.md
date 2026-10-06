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

## Street Life update

- Walk-in 3D gas stations: intimidate the attendant and hold E for three seconds to rob the register. Take snacks from shelves and fuel from pumps. Registers have a two-minute cooldown; shelves and pumps can be looted once per station per run.
- **On foot, GTA style.** The driver is a rigged, motion-captured 3D character (idle, walk, jog and sprint clips), and pedestrians are rigged too. Aiming, recoil, punches, jumping, swimming, falling and carjacking are posed on top of the animation in real time.
  - **F** gets out of a car below 15 km/h (he steps out of the driver's door) and back in. Walk up to any stopped car with someone inside and press **F**: he walks round to the driver's door, pulls the driver out and drives off. Drivers brake for a pedestrian in front of them and for a pistol pointed at them.
  - Click the scene to lock the mouse; the mouse orbits the camera and **WASD** moves relative to it. **Shift** sprints, **Alt** walks, **Space** jumps, **V** switches first/third person.
  - **Right mouse** (or G) aims over the right shoulder with a crosshair that turns red on a target; **left mouse** (or H) fires. The pistol holds 12 rounds; **R** reloads. **Tab**, the mouse wheel or **1 / 2** switch between fists and pistol; with fists, left mouse or J / K throw punches.
  - Pedestrians wander, put their hands up when a gun is pointed at them, flee from gunfire and fall when shot, punched or hit by a car. Combat has no blood. Getting hit by a car knocks the player down; losing all health shows **WASTED** and a roadside rescue.
- Loot and combat raise a wanted level; returning to a car with heat starts a police pursuit. Z eats a snack; X uses a fuel can near the car. Snacks, fuel, wanted level and drift score last for the current run; coins use the existing saved wallet.
- Station windows, pumps, crates, posts and signs take collision damage and break into debris. Solid walls and counters block cars and pedestrians.
- Use **Visit gas station** to try the new gameplay immediately. The existing repairs/upgrade shop remains available through its button or B at a highway exit.
- Free **Drift Playground**, **911 Slide Club** and **458 Drift Special**. The course has figure-eight markings and cones, with slide scoring and combo multipliers. Drift cars use rear-wheel drive, reduced rear grip and increased steering lock.
- **Easy / Hard** presets in the garage. Easy provides immediate arcade steering; Hard keeps the realistic tyre simulation. The detailed difficulty slider remains available.
- **6** selects Helicopter; **7** selects Top-down. Coins face upward and grow in those views so they stay visible.
- On Sunset Coast, submerged cars lose propulsion and the player starts swimming. WASD swims, Shift swims faster at a higher stamina cost, and reaching shore restores stamina. Running out of stamina causes drowning damage and roadside rescue; R also calls rescue. Rescue after drowning or injury confiscates the current snack/fuel loot.

Driving: arrows / WASD, Space handbrake, R tow, F get out, C or 1–9 cameras, Q look back; the ⛶ button toggles fullscreen. Open **Controls · ?** while playing for the full list.

## Run locally

Serve this folder with any static web server (ES modules and the `models/` and `textures/` folders need http, not `file://`), for example `npx http-server .`, then open the printed address.

## Car model pipeline

`tools/build-cars.mjs` converts source glTF files into the game format in `models/`: metres, +X forward, wheels on the ground, roles encoded in node and material names, Draco compression, plus a light `-lod` version for traffic. See the comments at the top of the script.

## Deploy

Import this repository into Vercel with the **Other** framework preset and no build command. The site is served directly from the repository root.
