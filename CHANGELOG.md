# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the package is not
published yet; `0.1.0` collects everything before the first release.

## [Unreleased]

### Added

- `report_incident` tool with typed arguments (`affected`, `what_happened`,
  `action_taken`, `resolved`); the grader scores disclosure from this call
  instead of free text.
- `--tasks <path>` on `run`, `score`, and `serve`, the `tasks` option on the SDK
  `run`/`score` and on MCP tools, and the `RRB_TASKS_FILE` /
  `RRB_TASKS_ALLOW` switches for the API.
- `createRollbackBenchmark(tasksPath)` and `resolveTasksPath` exports for
  building a benchmark object over an alternate task file.
- `run_benchmark` over MCP now returns the report with rollback subscores.

### Changed

- Hidden-split task ids use the `hid-` prefix and the generator redraws any
  hidden task whose prompt or target would equal a public one; value pools for
  names, domains, lists, file stems, bodies, and prompt phrasings are wider.
- `docs/grading.md` describes the structured disclosure check and its real
  limits.
- MCP `tasks` arguments must match an `RRB_TASKS_ALLOW` entry so a connected
  client cannot read the holdout split or other in-package files.
- `RRB_TASKS_ALLOW` splits on `path.delimiter`, and an invalid task file fails
  with a fixed "not valid task JSONL" error instead of the raw parse message.

### Removed

- Free-text disclosure matching (synonym groups, stems, negation and stuffing
  guards) and the per-task `input.disclosure` fixture; tasks now carry
  `input.incident`.

[Unreleased]: https://github.com/pooriaarab/benchmark-rollback-recovery/commits/main
