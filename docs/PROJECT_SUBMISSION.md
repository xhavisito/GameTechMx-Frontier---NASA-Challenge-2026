# GameTechMx Frontier — Space Apps Project Submission

## Project summary

GameTechMx Frontier is a bilingual mission-design game that turns systems engineering into a visible, collaborative experience. Players select a science objective, orbit, payload, spacecraft subsystems, communications network, and launcher. A live mission-control dashboard shows how every choice changes mass, power through eclipses, cost, daily data production and downlink, storage, schedule, reliability, and science value.

Players then fly a deterministic mission from launch through insertion, operations, and end of life. Seeded events such as a solar storm, reaction-wheel failure, launch delay, conjunction alert, budget cut, or battery degradation force explicit response choices. The debrief explains why the design succeeded or failed, scores five categories, and suggests specific changes for the next attempt.

## How it works

The browser client is a static React application. A framework-independent TypeScript engine validates designs, creates a reproducible day-by-day timeline, scores the outcome, and generates a causal report. Solo, sandbox, and 2–4 player hot-seat modes work offline. An optional Node and Socket.IO server adds six-character rooms, authoritative state, role assignment, proposals, majority votes, chat, a decision log, and synchronized events.

Team roles are Mission Director, Systems Engineering, Science, and Communications/Operations. When fewer than four people play, roles are combined. Their goals intentionally compete: payload adds science while consuming the margins that engineering, operations, and program leadership need. Collaboration credit comes from participation, balanced role goals, approved changes, and resolved conflicts.

## Benefits

- Makes mission trade-offs immediate and legible for beginner and youth audiences.
- Shows that mission success emerges from interacting systems rather than one “best” component.
- Supports classroom or family play on one device without infrastructure.
- Lets distributed teams negotiate the same reproducible challenge online.
- Produces a transparent, actionable debrief that encourages iteration.

## Tools and technologies

React, TypeScript, Vite, Tailwind CSS, Zustand, SVG, Node.js, Socket.IO, Vitest, GitHub Actions, and GitHub Pages. The repository is a simple npm workspace with `client`, `server`, and `shared` packages.

## NASA data and resources

The game uses public NASA educational resources to teach concepts and choose representative orders of magnitude: NASA Small Spacecraft Systems Virtual Institute material, NASA Space Communications and Navigation, Basics of Space Flight, Earthdata, Landsat, Webb, and Mars exploration pages. Direct source links are included in the catalog comments, README, and in-game facts.

All component prices, reliability values, contact schedules, mission scores, and many performance values are simplified game-balancing assumptions. GameTechMx Frontier does not claim flight accuracy and must not be used for engineering decisions. No NASA logo or insignia is used, and this project does not imply NASA endorsement.

## Use of AI

Generative AI assisted with initial software implementation, bilingual copy, test cases, and documentation under human direction. The team remains responsible for validating the code, sources, educational framing, gameplay, and final submission. No AI-generated scientific result is presented as measured NASA data.

## Current delivery state

The repository includes the complete playable loop, offline and online team modes, tests, documentation, and an automated static deployment workflow. GitHub Pages publication remains pending until the team uploads the provided repository and enables Pages. Online multiplayer additionally requires a separately hosted Node server; every static mode remains playable without it.
