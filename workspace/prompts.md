# Conversational Prompts

Status: Active

## User To Overseer: Initiate Or Refresh Runway

```txt
Overseer: initiate from the Aura Tone repo root.

Confirm cwd, repo root, branch, tree health, workspace files, active milestone, and latest handshake sequence.

Read AGENTS.md if present, workspace/overview.md, workspace/current.md, recent workspace handshakes, docs/README.md, package.json, and the shared Aura coordination authority.

Do not create a full docs hierarchy speculatively.
Look ahead and define a bounded Dev runway in workspace/current.md.

Report:
- why this runway is safe
- what is intentionally excluded
- what requires human decision
- expected Dev handshake filename
```

## User To Dev: Execute Current Runway

```txt
.
```

## User To Dev: Narrow Execution

```txt
Dev: use the dot protocol, but execute only [named portion] of workspace/current.md.
Leave evidence and verification output in the packet.
Create the expected handshake, adjusted only if the narrowed scope changes the filename.
```

## User To Overseer: Review Dev Work

```txt
Overseer: review the Dev handoff and latest DevHS file.
Audit tree health and verification.
Judge against workspace/current.md, workspace/overview.md, docs/README.md, package.json, and the shared Aura coordination authority.
Accept, redirect, or rewrite current.md.
Create the next OverseerHS file.
```

## User To Overseer: Milestone Closure

```txt
Overseer: assess whether the active milestone is complete.
If accepted, update durable docs only where truth changed, batch archive milestone handshakes to workspace/complete/milestone-XX/, update workspace/overview.md, and rewrite workspace/current.md for the next milestone or idle state.
```

## User To Agent: Chat Retirement

```txt
Use the Agent Chat Retirement Process.
Write only evidence-bound lessons from this chat/session and artifacts explicitly observed during it.
Do not invent lessons for completeness.
```

## User To Overseer: Dot Signal

```txt
.
```

Meaning:

```txt
Work products are complete. Handoff is ready to read. Review the handoff and state, develop the new current runway, confirm project state, and on milestone completion move handoffs to archive and complete audit/code review. Return for discussion if unsure.
```
