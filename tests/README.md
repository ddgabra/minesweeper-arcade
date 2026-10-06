# Browser regression checks

Run in a disposable browser profile against a static server. These checks deliberately change that profile's garage and coin balance and move the player to test locations.

With the game loaded, evaluate each file in the page's JavaScript context, in this order:

1. `start-check.js` starts a Country Roads run and builds a station.
2. `game-check.js` checks robbery rewards and cooldown, single-use loot, car ownership transfer, combat, prop collision damage, swimming, rescue, cameras and difficulty presets.
3. `drift-check.js` starts the drift map and checks slide scoring, physics stability, camera-facing coins and keyboard walking.
4. `coast-check.js` starts the real Sunset Coast map and checks water entry, swimming movement and drowning rescue.

The scripts return assertion results or throw on failure. They stop the animation loop to make simulation checks deterministic. Reload afterward to play normally. Also inspect browser errors and visually check the station, aerial coins and drift course.

Syntax checks: `node --check highway.js` and `node --check street-life.js`.
