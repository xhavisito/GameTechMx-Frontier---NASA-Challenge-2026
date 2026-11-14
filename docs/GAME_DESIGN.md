# GameTechMx Frontier — Game Design and Educational Model

## Design principle

The model favors causal clarity over precision. Values have explicit units and equations are short enough for a learner to reproduce with a calculator. It is not a trajectory, thermal, structural, cost, or link-budget engineering tool.

## Resource ledger

All costs are USD millions; mass is kg; power is W; energy is Wh; data is decimal GB.

- `mass = Σ(component mass + instrument mass)`
- `average solar = rated solar × orbit solar factor × (1 − eclipse fraction)`
- `average generation = average solar + RTG generation`
- `consumption = Σ(component power + instrument power)`
- `eclipse energy = max(0, consumption − RTG) × capped eclipse hours`
- `downlink GB/day = link Mbps × contact minutes/day × 60 ÷ 8000 × 0.65`
- `daily backlog = generated + stored − downlinked`
- `lost data = max(0, daily backlog − storage capacity)`
- `development cost = hardware cost × (1.2 + rush months × 0.025)`
- `total cost = development + launcher + ground setup + daily operations × lifetime`

The 0.65 communications factor represents acquisition, protocol, scheduling, and weather losses in one teachable number. Difficulty multiplies the scenario budget by 1.25, 1.0, or 0.85 and also changes failure exposure. Eclipse hours are capped because transfer and halo entries are educational destination abstractions, not circular orbits.

## Validation

`validateDesign` checks required subsystem categories, scenario/orbit fit, launcher destination and mass capacity, structural capacity, average energy, eclipse battery, budget, daily data and total storage, pointing, thermal capability, development deadline, mission lifetime, propulsion reserve, and science relevance. Each issue has bilingual evidence and a repair suggestion.

## Deterministic simulation

The engine uses a local FNV-1a seed hash and Mulberry32 generator. It never depends on ambient `Math.random`. Identical design, responses, difficulty, and seed therefore yield identical launch risk, event schedule, contact variation, and timeline.

Phases are launch, insertion, accelerated daily operations, and end of life. Health, array/battery degradation, power availability, safe-mode pauses, contact variation, storage overflow, delivered science, cost, and orbital lifetime update once per day. Science is credited only when data reaches Earth.

Six event templates expose a trade-off between health, cost, lost days, power, and science: solar storm, reaction-wheel failure, budget cut, launch delay, conjunction/debris alert, and battery degradation. Responses alter the computed outcome; unanswered events use a deliberately risky default so a report can still be generated.

## Score (100 points)

| Category | Maximum | Basis |
|---|---:|---|
| Objective success | 40 | Fraction of mission requirements passed |
| Science | 20 | Useful science delivered against scenario target |
| Resource efficiency | 15 | Mass margin, budget contingency, delivered/captured data |
| Robustness | 15 | Final health, component reliability, events answered |
| Collaboration | 10 | Participation, balanced role goals, resolved conflicts |

Solo and sandbox receive the coordination allocation automatically. Team modes earn it from evidence recorded by the proposal/voting system. Category values are capped, then summed. Grades: S ≥ 90, A ≥ 80, B ≥ 65, C ≥ 50, D below 50.

## Team mechanics

Mission Direction values a 20% budget reserve; Systems Engineering values launch, structure, and power margins; Science values useful output; Communications/Operations values a daily link that keeps up with payload data. Changes, launch authorization, event responses, and redesign are proposals. A strict majority approves; a completed tie rejects. Disagreement followed by an accepted revision counts as a resolved conflict.

Local hot-seat uses the same serializable room and voting rules as online play. The online server binds players to sockets, validates imported designs and event choices, limits input size and action rate, rejects stale revisions, and lets only the host advance the shared clock. Rooms live in memory by design.

## Accessibility and learning

Resource status uses symbols and text as well as green, amber, and red. Controls are semantic buttons/inputs with visible focus; layouts reflow for tablets; motion respects `prefers-reduced-motion`; reports include tables alongside SVG charts. Spanish and English strings are kept in JSON or localized catalog records. Source links and explicit “educational approximation” labels help learners distinguish a game model from mission analysis.
