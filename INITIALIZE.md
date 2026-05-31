# Initialize A New Aura Project

Guide: Historical Aura Core seed boot note. Aura Tone has already been copied from the seed.

This folder is now the Aura Tone project shell.

Current seed state:

```text
.git         absent
node_modules absent
.tmp         absent
```

The folder is intended to be copied or renamed into a new project directory, then bootstrapped by Codex.

## Human Step

Copy or rename the top-level folder.

Example:

```text
Aura_core -> My_New_Aura_Project
```

After that, open Codex in the renamed/copied project folder and give it this instruction:

```text
Boot this Aura Tone shell. Mirror the project name where needed, run npm install, run npm run verify:all, then initialize git only if the human asks.
```

## Codex Boot Checklist

Codex should do the following from the new project root.

## 1. Confirm Starting State

Confirm these local state folders are absent:

```text
.git
node_modules
.tmp
```

If one exists because the folder was copied from an already-used project, ask before removing it.

## 2. Mirror The New Project Name

Infer the project name from the current directory name.

Update:

```text
package.json
package-lock.json
src/constants.js
README.md
docs/current-state/seed-current-state.md
```

Expected edits:

- `package.json` `name`
- `package-lock.json` root package `name`
- app display name in `src/constants.js`
- User-Agent in `src/constants.js`
- README title and first description
- current-state note title/body where it still says Aura Core

Keep reusable module names such as `Frame`, `TaskRunner`, and `ServiceRegistry` unchanged.

## 3. Install Dependencies

```powershell
npm install
```

## 4. Verify

```powershell
npm run verify:all
```

Do not continue to git initialization until verification passes.

## 5. Initialize Git

```powershell
git init
git add .
git commit -m "Seed Aura Tone from Aura Core"
```

If Git reports safe-directory or ownership warnings, resolve those before committing.

## 6. Optional App Smoke

Only after verification passes:

```powershell
npm start
```

Use this to visually confirm the Electron shell opens, the Frame controls render, and the Pin/Minimize/Close buttons are visible.

## First Project Notes

Before adding domain code, create or update:

```text
docs/current-state/seed-current-state.md
docs/gap/to-do/README.md
docs/adr/
```

Recommended first Codex prompt after boot:

```text
Review the initialized seed and create the first project-specific current-state note and gap list. Do not add domain implementation yet.
```

## Seed Rule

```text
Borrow proven rigging. Do not import domain weight before the domain has earned it.
```
