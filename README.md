# Aura Tone

Aura Tone is a light local sound panel for phase, gear, connector, and coherence experiments.

It starts from the Aura Core shell so the project can stay small while keeping useful local app rigging.

Current intent:

- gear phase lanes
- connector coherence readouts
- a generative field tone between discrete gear events
- terminal-ish presentation
- portable renderer-first implementation where possible

High-level concept: `docs/high-level-view.md`

Inherited rigging:

- stateful documentation folders and templates
- pure core modules with fixture-first verification
- service command registry
- task runner with progress, warnings, cancellation, and lock classes
- message taxonomy for consistent diagnostics
- HTTP client wrapper with timeout, cancellation, retry, injected fetch, and request logging hooks
- minimal Electron shell for local app projects

The first build should stay renderer-owned: Web Audio, phase math, compact controls, and no persistence until presets, exports, or adapters earn a backend service.

## Verification

```powershell
npm run verify:all
```

## App Shell

```powershell
npm start
```

## Portability Rule

Borrow proven rigging. Keep the sound engine portable before adding project-specific machinery.
