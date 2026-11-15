# GameTechMx Frontier — repository instructions

## Product
A bilingual (Spanish/English), open-world, low-poly space exploration game for NASA Space Apps 2026, playable by all ages with **no tables, numbers or menus to understand**. The game starts straight in the open world on Earth: drive to the hangar, pick a destination and what to bring (big buttons), drive to the rocket, launch, travel, and play one of three missions: Mars (rover, samples, meteors), Jupiter (fly around the planet and scan 4 zones), Miller (ocean planet, find signs of life, giant waves). Brand every surface **GameTechMx Frontier**. Do not use NASA insignia or claim NASA endorsement.

## Rules
- Keep it simple: one clear goal on screen, big buttons, short sentences. If a feature needs explaining with numbers, simplify it.
- Visual style: low-poly, warm flat colors, chunky outlines and solid shadows. No glow, glassmorphism, monospace micro-labels or dark-cyan "AI" look.
- Controls must always work on keyboard, gamepad and touch (joystick + button). Respect `prefers-reduced-motion`.
- Everything is in `client/` (React, TypeScript, Vite, Three.js via react-three-fiber). Pure game logic (`src/world/marsWorld.ts`) stays deterministic and tested with Vitest.
- `npm test` and `npm run build` must pass before every PR. Work on a branch, open a PR, merge, and verify the GitHub Pages deploy. Never commit secrets, node_modules or dist.
- Report only what was actually verified; say what was not tested (real gamepad/touch devices, live site gameplay).

## Roguelite layer
Pure logic lives in `meta.ts` (upgrade tree, perks, draft cards, save), `combat.ts` (`CombatSim`), `pois.ts` (`PoiSim`), `contracts.ts`, `runkit.ts`, `runstate.ts` (effects that last several missions + reputation), `tripevents.ts` (random pre-mission events), `board.ts` (mission board jobs). Worlds (`MarsWorld`, `JupiterOrbit`, `MillerOcean`) take `perks`, `contract`, `tier` props and report `kills/pois/exploded/lost` in `MarsResult`; `Adventure.tsx` owns meta state, draft, rewards. UI: `workshop.tsx`. Keep it readable for all ages and keep keyboard + gamepad + touch working.
- Crew & story: `world/crew.ts` (mates, additive perk fx, saved in `frontier-crew-v1`) and `world/chapters.ts` (6 chapters as pinned Jobs on the board; completion fires `track({t:'chapter'})` → beat `chN`, stat `chapters`, achievement `saga`).
