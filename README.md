# canyon-glider

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/wangsanur07/canyon-glider/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/wangsanur07/canyon-glider/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

Canyon Glider is an endless low-poly 3D glider game. Fly a glider through a procedurally generated canyon: thread golden wind rings, skim past pillars for near-miss bonuses, refuel through green rings, and complete rotating missions — all while your fuel burns and the canyon gets narrower. Three biomes (canyon dawn, ocean islands, storm night), set-piece runs, procedural wind audio, and a one-tap retry keep every flight short, tense and replayable.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. No build step, no network: every file the game loads lives under `game/`.

## Controls

- **A / D** or **← / →** — steer (bank and turn)
- **W / S** or **↑ / ↓** — climb and dive (diving trades altitude for speed and score)
- **Shift** — boost (burns fuel fast)
- **Space** — airbrake (slower, tighter turns)
- **Drag** — steer on touch and mouse
- **R** — instant retry · **P** — pause · **M** — mute

## How it plays

- **Score** — distance flown, rings × combo multiplier, near-miss bonuses, mission bonuses.
- **Fuel** — drains as you fly, faster on boost. Green rings refill it. Run dry and you glide on fumes.
- **Damage** — three hits (pillars, walls, canyon floor) end the flight. A close pass without touching is a near-miss: bonus points, a slow-motion beat, and a combo push.
- **Missions** — three rotating goals at a time (rings, fuel rings, near-misses, distance, combo, clean flight). Each one pays 500 points.
- **Biomes** — the canyon changes as you fly further: dawn, ocean islands, then a storm night with lightning.
- **Daily seed** — the canyon is seeded by the date, so everyone flies the same canyon on the same day.

## Screenshots

Three renders of the game itself, taken in desktop Chrome from the code in
`game/` (deterministic seeds, `?shot=start|play|end`):

- `screenshots/1-start.jpg` — title screen over the canyon, glider in frame
- `screenshots/2-play.jpg` — mid-flight, HUD lit, rings ahead
- `screenshots/3-end.jpg` — flight over, score and best

## Layout

- `game/index.html` — the page, HUD and import map
- `game/src/main.js` — boot, fixed-timestep loop, screenshot modes
- `game/src/game.js` — state machine, scoring, missions, collisions
- `game/src/flight.js` — flight model (bank, pitch, throttle, fuel, damage)
- `game/src/world.js` — seeded chunk generator (walls, pillars, rings, biomes)
- `game/src/render.js` — three.js scene, chase camera, instanced canyon, juice
- `game/src/input.js` — keyboard, pointer, touch and gamepad as actions
- `game/src/hud.js` — DOM instruments: altitude, speed, heading, fuel, missions
- `game/src/audio.js` — procedural WebAudio (wind, chimes, ambient pad)
- `game/src/config.js` — every tuning number in one place
- `game/src/random.js` — seeded RNG (mulberry32)
- `game/vendor/three.module.min.js` — vendored three.js r160
- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`
- `screenshots/` — three renders of the game (start, play, game over)

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
