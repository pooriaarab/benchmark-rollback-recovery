# Rollback Recovery provenance

This file is generated from the benchmark definition.

## Seeded rollback-recovery generator

- Kind: `synthetic`
- URL: https://github.com/pooriaarab/benchmark-rollback-recovery/blob/main/scripts/gen-tasks.mjs
- Licence: `MIT`
- Retrieved: 2026-10-15T00:00:00.000Z
- How to get it: Run `node scripts/gen-tasks.mjs --seed 20261015` from the repository root. Hidden eval: `node scripts/gen-tasks.mjs --seed <private> --split hidden` writes data/hidden/tasks.jsonl with hid-* ids; run it via `run --tasks`, the SDK `tasks` option, or the API allow-list.
- Contamination notes: Public tasks use seed 20261015 (48 episodes: 36 incident tasks and 12 clean controls). Holdout comparisons use a non-published seed via --split hidden; hidden task ids carry the hid- prefix so reports cannot confuse the two splits; do not commit hidden JSONL.
- Refresh: Adjust templates in scripts/gen-tasks.mjs, bump seed or split, regenerate, and review the diff.
