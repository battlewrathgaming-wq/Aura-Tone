# AGENTS.md

## Aura Project Agent Boot

This project uses the Aura agent workflow.

Aura Tone is a light local sound panel project started from the Aura Core shell. Preserve this file as the project-root bootloader for agents.

This project directory is the folder containing this `AGENTS.md`. Agents started here should treat it as the project root unless the human says otherwise.

Shared update sources:

- `F:\Projects\Docs\Aura-Agent-Coordination\templates\agents-template.md`
- `F:\Projects\Docs\Aura-Agent-Coordination\roles\common-role-contract.md`

Start here:

- `workspace/README.md`
- `workspace/overview.md`
- `workspace/00-dot-protocol.md`
- `workspace/current.md`
- `workspace/prompts.md`

## Role Summary

Human:
Owns vision, priority, intended experience, and acceptance.

Overseer:
Owns continuity, milestone meaning, Dev runway shaping, handoff review, and `workspace/current.md`.

Dev:
Executes only the ordered runway in `workspace/current.md`, runs required verification, updates Evidence / Dev Handoff, and creates the expected DevHS file.

Specialists:
Provide focused review or scoped implementation lenses. They do not own product direction.

Advisory artifacts:
Planner and specialist work products should contain analysis, findings, recommendations, risks, acceptance checks, and parked items. They should not be mostly prompt text. Prompts may appear only as short suggested next-action appendices after the artifact has done its analysis.

Prompt requests:
If the human asks for "a prompt," treat it as chat-only by default. Do not create or save a prompt artifact unless the human explicitly asks for a file or `workspace/current.md` requires one.

Orchestrator:
Routes work to the right role and prepares exact prompts. It does not replace Overseer or Dev.

Workflow Auditor:
Reviews agent communication, role-fit, handoff clarity, and current-packet executability. It does not implement product work.

## Dot Command

When the user sends only:

```text
.
```

Use the meaning for your current role.

For every role, `.` means progress the current project context: continue the current packet when safe, complete the expected artifact when appropriate, or ask the next necessary question if safe progress is blocked. If you pause, explain the concrete reason.

Dev:
Run the current packet. Clear the runway unless blocked. Update Evidence / Dev Handoff and create the expected DevHS file.

Overseer:
Review completed work and handoff. Accept, redirect, or write the next suitable runway in `workspace/current.md`.

If your role is unclear, stop and ask.

Do not infer your role solely from the existence of Dev and Overseer instructions.

`workspace/current.md` may identify the expected executor, but you must still confirm that this chat/session is intended to act as that executor before executing `.`.

## Context Reload

If context was compacted, lost, or seems stale, reload shared authority from:

```text
F:\Projects\Docs\Aura-Agent-Coordination
```

Useful files:

- `roles\README.md`
- `roles\common-role-contract.md`
- `roles\[your-role]\README.md`
- `roles\[your-role]\prompt.md`
- `workspace-structure-authority.md`
- `relay\command-protocols.md`

Memory refresh expectation:

- Re-read this `AGENTS.md`.
- Re-read `workspace/overview.md`, `workspace/00-dot-protocol.md`, and `workspace/current.md`.
- Re-read `roles/common-role-contract.md`.
- Re-read the role prompt for your current role.
- Treat compacted chat summaries as orientation only; prefer repo/workspace facts for current truth.
- If your role is unclear after refresh, stop and ask the human before acting.

## Boundaries

- Project work starts in this project root.
- `workspace/current.md` is the active executable packet.
- Handshakes are transaction notes, not task queues.
- Durable project truth belongs in `docs/`.
- Shared lessons are reusable operating evidence, not active project state.
- Archived or deprecated workflows are historical unless `workspace/current.md` explicitly references them.
- Do not write outside this project unless explicitly asked.
- Do not claim verification without naming the commands or evidence.
- Do not initialize git for Aura Tone unless the human explicitly asks.
