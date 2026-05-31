# Dot Protocol

Status: Active
Signal: `.`

## Meaning

The dot command is role-sensitive.

If your role is unclear after context loss or compaction, stop before action and ask the human to identify the role.

Do not infer your role solely from the existence of Dev and Overseer instructions.

`workspace/current.md` may identify the expected executor, but you must still confirm that this chat/session is intended to act as that executor before executing `.`.

## Dev Meaning

If the user sends only `.` in a Dev chat, Dev should read it as:

```text
Runway has been set up.
Review the current packet.
Clear the runway unless there is a real blocker.
Report back with evidence and leave a handoff.
Perform required state documentation and git steps when the packet requires them.
```

Dev must:

1. Confirm cwd, repo root, branch, tree health, and workspace files.
2. Read `AGENTS.md` if present.
3. Read `workspace/overview.md`.
4. Read this file.
5. Read `workspace/current.md` from top to bottom.
6. Read source documents named in `current.md`.
7. Execute the ordered runway in `current.md`.
8. Update Evidence and Dev Handoff in `current.md`.
9. Create the expected `DevHS##-[focus].md` handshake named in `current.md`.
10. Run required verification.
11. Perform state documentation and git steps only where the packet or user asks for them.
12. Return a concise handoff.

## Overseer Meaning

If the user sends only `.` in an Overseer chat, Overseer should read it as:

```text
Work products are complete.
A handoff is ready to read.
Review the handoff and state.
Develop the new current runway.
Confirm project state.
On milestone completion, move handoffs to archive and complete audit/code review.
Return for discussion if unsure.
```

Overseer must:

1. Confirm cwd, repo root, branch, tree health, workspace files, active milestone, and handshake sequence.
2. Read `AGENTS.md` if present.
3. Read `workspace/overview.md`, `workspace/current.md`, and the latest Dev handoff.
4. Review required source docs, current-state docs, roadmap/audit docs, and verification evidence.
5. Accept, redirect, or mark the work incomplete.
6. Create the next `OverseerHS##-[focus].md` review/handoff when appropriate.
7. Rewrite `workspace/current.md` with the next bounded Dev runway.
8. Update `workspace/overview.md` if milestone status or sequence changed.
9. If the milestone is complete, batch-move milestone handshakes to `workspace/complete/milestone-XX/`.
10. Complete milestone audit/code review where required by the project.
11. Return for discussion when product intent, architecture, verification, or milestone acceptance is uncertain.

## Must Do

- Preserve existing user/Dev changes.
- Treat `workspace/current.md` as the only active execution packet.
- Use roadmap/current-state/audit docs for meaning, not as hidden task queues.
- Leave evidence of what was done, verified, deferred, and risked.

## Must Not Do

- Do not infer tasks from handshakes.
- Do not create hidden task queues.
- Do not recreate deprecated `docs/gap` workflow.
- Do not run live/private/destructive operations unless authorized.
- Do not broaden scope beyond the current runway.

## Return Conditions

Return to chat immediately if:

- cwd is not the project root
- sequence state conflicts with visible handshakes
- instructions conflict
- live network/API action is needed without authorization
- destructive or external mutation is required
- required input/artifact is missing
- a test failure reveals a doctrine or architecture decision

