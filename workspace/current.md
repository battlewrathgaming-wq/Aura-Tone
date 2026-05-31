# Current Workspace Packet

Status: Active
Updated: 2026-05-31
Owner: Human direction, Dev execution

## Coordination State

Active milestone: M00 - Aura Tone Shell Identity
Roadmap source: None yet
Sequence: HS01
Previous accepted handshake: None
Current executor: Dev
Current focus: retone the copied Aura Core shell as Aura Tone
Expected output: DevHS01-aura-tone-shell-identity.md
Archive target on milestone completion: `workspace/complete/milestone-M00/`

## Purpose

This is the only active executable work packet for Aura Tone.

Aura Tone starts from the Aura Core rigging, but should now read as a light local sound panel project rather than a neutral seed.

## Required Reading

- `workspace/overview.md`
- `workspace/00-dot-protocol.md`
- `docs/README.md`
- `package.json`

## Runway Objective

Rename visible app identity and starter language so the Electron shell reads as Aura Tone while keeping the inherited Core rigging intact.

## Ordered Runway

1. Update package metadata and runtime constants.
2. Update the visible Electron renderer title and starter copy.
3. Retone README and workspace docs with slim Aura Tone language.
4. Run deterministic verification when dependencies are installed.
5. Record any start/install issue in chat.

## Guardrails

- Do not implement the sound engine in this packet.
- Do not add broad documentation.
- Keep service command names stable unless a later packet requires a deeper rename.
- Keep inherited Core utility modules unless they block the Tone shell.

## Verification Required

Run when local dependencies are present:

```powershell
npm.cmd run verify:all
```

If dependencies are missing, run `npm.cmd install` first with human approval if the sandbox requires it.

## Evidence

Dev updates this before handoff.

Verification run:

```txt
npm.cmd run verify:all
Passed: core utilities, services, HTTP client, SDE source bundle utility, Frame module, renderer shell, all checks verified.
Electron local binary check: .\node_modules\.bin\electron.cmd --version -> v42.2.0.
```

Files changed:

```txt
package.json
package-lock.json
README.md
AGENTS.md
INITIALIZE.md
docs/README.md
workspace/README.md
workspace/overview.md
workspace/current.md
workspace/prompts.md
src/constants.js
src/services/serviceRegistry.js
src/renderer/index.html
```

Findings:

```txt
Copied project was missing node_modules; npm.cmd install completed successfully.
Electron binary install needed a follow-up npx.cmd install-electron --no after the local binary check found dist missing.
Electron shell identity now reads as Aura Tone.
```

Deferrals:

```txt
Sound engine, terminal panel layout, and portable adapter design are deferred to the first product implementation packet.
```

## Dev Handoff

Dev fills this in when work is complete:

- completed tasks:
- tests added/updated:
- verification output:
- failures found:
- handshake created:
- remaining risk:

## Overseer Review

Overseer fills this in after Dev handoff:

- accepted / redirected:
- doctrine drift:
- architecture risk:
- state updates needed:
- next packet:
