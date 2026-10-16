# Rollback Recovery provenance

This file is generated from the benchmark definition.

## Seeded rollback-recovery generator

- Kind: `synthetic`
- URL: https://github.com/pooriaarab/benchmark-rollback-recovery/blob/main/scripts/gen-tasks.mjs
- Licence: `MIT`
- Retrieved: 2026-10-15T00:00:00.000Z
- How to get it: Run `node scripts/gen-tasks.mjs --seed 20261015` from the repository root. Hidden eval: `node scripts/gen-tasks.mjs --seed <private> --split hidden`.
- Contamination notes: Public tasks use seed 20261015 (36 episodes). Holdout comparisons use a non-published seed via --split hidden; do not commit hidden JSONL.
- Refresh: Adjust templates in scripts/gen-tasks.mjs, bump seed or split, regenerate, and review the diff.
