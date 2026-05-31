# Aura Tone High Level View

Status: Draft
Updated: 2026-05-31

## Product Shape

Aura Tone is a light local sound panel for hearing phase, convergence, and coherence.

It is not a DAW, drum machine, evidence system, or broad audio workstation. The first product should feel like a compact terminal-ish instrument: a small audible machine that lets gears drift, connectors pull apart, and coherence return.

The first build should stay renderer-first:

- Web Audio in the renderer
- phase and connector math in portable JavaScript
- compact Electron shell from Aura Core
- no persistence until presets, exports, or adapters earn it

## Core Sound Model

Aura Tone has two primary sound layers.

### Gear Tones

Gear tones are discrete events.

Each gear has a phase, tooth count, speed, tone, and trigger shape. When a tooth crosses the trigger point, the gear emits a short ping, click, pulse, or blip.

Useful first properties:

- `teeth`
- `speed`
- `phase`
- `tone`
- `voice`
- `probability`
- `accent`

The gear layer should sound mechanical and legible. It gives the listener the sense of separate bodies moving.

### Field Tone

The field tone is the sound between gear events.

It is a constant, stepped, gliding, or sample-and-hold frequency shaped by phase relationships. It should not feel like a normal melody lane at first. It should feel like the machine's coherence pressure becoming audible.

Useful first modes:

- `constant`
- `stepped`
- `glide`
- `sample-hold`

Useful first sources:

- phase sum
- nearest convergence
- selected connector pair
- random walk
- agent or human patch input

## Connectors

Connectors are the main relationship layer.

A connector links two gears and describes how much they influence each other. Pulling a connector apart lowers coherence and lets the gears drift. Bringing it together increases influence, tension, and the chance of lock-like moments.

Useful first properties:

- `from`
- `to`
- `distance`
- `coherence`
- `tension`
- `slip`
- `conductivity`
- `snap`

The connector can have a voice of its own through the field tone. The gears make events; the connectors make the relationship audible.

## Coherence

Coherence is the felt state of phase relationship.

When gears are far apart, the sound should be duller, more independent, or more unstable. As they approach alignment, the field tone can brighten, bend, step faster, or increase modulation. Near convergence, the system can produce a transient, harmonic lock, or sharper resonance. After passing, it can decay, detune, or drift.

The important test:

```txt
When a connector is pulled apart and brought together, does it feel like coherence is physically leaving and returning?
```

If that test works, the product has a spine.

## First Screen

The first screen should be the instrument, not a landing page.

Suggested layout:

```txt
[transport / tempo / global coherence]

[gear lanes]
A teeth 11 speed 1.00 phase 031 tone 180Hz
B teeth 07 speed 0.63 phase 188 tone 247Hz
C teeth 13 speed 1.37 phase 274 tone 330Hz

[connectors]
A:B distance 62% coherence 31% slip 18%
B:C distance 37% coherence 68% slip 07%

[field]
mode stepped source convergence range 90-620Hz slew 22%

[event/readout stream]
tick 384 gear C fired
A:B near convergence
field stepped to 247Hz
```

Visual tone:

- terminal-ish
- compact
- readable at small window sizes
- restrained color
- live readout over decoration
- no heavy dashboard scaffolding in v1

## Agent Configuration

Agent-set configuration is a good future interaction.

Agents can propose patches: gear counts, speeds, connector properties, field mode, and intent. The human auditions and keeps, mutates, or discards the patch.

Example patch shape:

```json
{
  "agent": "Dev",
  "intent": "stable phase drift",
  "gears": [
    { "id": "A", "teeth": 11, "speed": 1.0, "tone": 180 },
    { "id": "B", "teeth": 7, "speed": 0.63, "tone": 247 }
  ],
  "connectors": [
    { "from": "A", "to": "B", "distance": 0.42, "slip": 0.18, "conductivity": 0.7 }
  ],
  "field": {
    "mode": "stepped",
    "source": "convergence",
    "range": [90, 620],
    "slew": 0.22
  }
}
```

This should remain human-auditioned. Agents may suggest machine states, but they should not silently take over the instrument.

## Parked Later Idea: External Cadence

A later adapter could use active log cadence as a universal multiplier.

This should not be required for the first build. The sound engine should stand alone first. Later, an external cadence signal could bend tempo, connector tension, field stepping density, or modulation depth.

Example:

```txt
internal clock:      120 bpm
cadence multiplier: 0.72x - 1.48x
effect:             tempo drift / connector tension / field density
```

Keep this as an adapter boundary, not a core dependency.

## V1 Boundary

Good first version:

- 3 or 4 gears
- 2 or 3 connectors
- gear event tones
- one field oscillator
- connector distance controls
- global tempo
- convergence readout
- start/stop
- randomize or mutate
- freeze current patch

Save for later:

- MIDI
- audio export
- sample import
- deep synth engine
- persistent project files
- live log cadence adapter
- agent patch library
- full preset browser

## Portability Direction

Keep the first engine portable enough that it can run outside Electron as plain browser JavaScript.

The Electron shell should provide local comfort: window chrome, always-on-top behavior, and later file or preset services. The sound model should remain separable from the shell.
