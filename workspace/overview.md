# Aura Tone Workspace Overview

Status: Active
Last reviewed: 2026-05-31

## Vision Statement

Aura Tone is a light local sound panel for phase, gear, connector, and coherence experiments.

It should stay renderer-first and portable where possible: Web Audio, compact terminal-ish controls, and slim documentation before deeper services or adapters are added.

## Coordination Model

- `workspace/current.md` is the only active executable work packet.
- Handshake files in `workspace/` are active-milestone transaction notes.
- Completed milestone handshakes move in batch to `workspace/complete/milestone-XX/`.
- `docs/` starts lean and grows durable records only when real product or architecture truth exists.
- Deprecated per-task gap folders are not part of the active Aura Tone launch model.

## Milestone Plan

| Milestone | Roadmap Source | Status | Notes |
| --- | --- | --- | --- |
| M00 | None yet | Active | Retone the copied Aura Core shell into Aura Tone. |

## Active Milestone

Milestone: M00 - Aura Tone Shell Identity
Roadmap source: None yet
Current packet: `workspace/current.md`
Current sequence: HS01
Latest accepted handshake: None

## Durable Record Index

### Docs

- `docs/README.md`

### Shared Coordination Authority

- `F:\Projects\Docs\Aura-Agent-Coordination\workspace-structure-authority.md`
- `F:\Projects\Docs\Aura-Agent-Coordination\agent-coordination-contract.md`
- `F:\Projects\Docs\Aura-Agent-Coordination\project-root-agent-startup-and-permissions.md`
- `F:\Projects\Docs\Aura-Agent-Coordination\agent-chat-retirement-process.md`

### Verification

- `package.json`
- `scripts/verify-all.js`

### Transaction Records

Active milestone handshakes:

- `workspace/`

Completed milestone handshakes:

- `workspace/complete/`

### Historical Archives

- `workspace/archive/` is legacy from the prior packet archive model if present. Do not use it for new coordination.

## Open Questions

- Which Core utilities should remain in Aura Tone after the first sound panel lands?
- Which parts of the sound engine need to stay portable for later reuse?
