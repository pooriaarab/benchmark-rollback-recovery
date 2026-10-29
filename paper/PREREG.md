# Rollback Recovery study plan

Registered in git before this study collects outcomes. No independent timestamp service is used. Publication is outside this task.
The accepted honesty pilot supplies layout and statistics only. No honesty outcomes or text are reused.
The existing recovery E2E script already asserts that a visible-information policy solves the public tasks. This is prior knowledge, not a new discovery.

## Questions and hypotheses
H1: The existing visible-information recovery policy passes more incident tasks than empty output.
H2: Removing structured reports preserves repaired state but reduces full incident success.
H3: Removing state tags reduces CRM/file repair; message repair remains unchanged.
H4 (simulated): Increasing report retention increases full success for a simulated population with otherwise complete recovery.
H1-H3 are diagnostic checks, not significance claims. H4 is a mechanism sensitivity study, not an agent leaderboard.

## Design and sample
Freeze benchmark source ca4058d1903df96c52c02206b60806881240a0e5, package 0.1.0, and its complete public task set (expected 48 tasks: 36 incidents, 12 controls).
Run empty, constant, echo, refuse, first-tool, packaged-good, and packaged-bad through the public run function. The first-tool policy calls the first tool once then stops.
Execute the existing visiblePolicy function from scripts/e2e.mjs against the public environment; record observations and replay its trace through benchmark.score.
Apply three trace ablations: remove report_incident; remove stateTag arguments; remove all mutating calls except report_incident. Re-execute each altered trace before scoring.
Repeat every baseline and ablation once. Hash semantic outputs without timing. Repeats add no independent tasks.
Simulated sweep: retain each incident report with probabilities 0, 0.25, 0.5, 0.75, 1. Use 100 simulated agents (seeds 1-100).
Use SHA-256 of seed:task-id as a uniform variate and common draws across retention levels. Clean traces are unchanged.
Replay all simulated traces through benchmark.score. Store every decision and grade; baseline traces provide the parent trace for each simulated row.

## Outcomes and analysis
Primary: full binary pass, with Wilson 95% intervals over tasks. Report incident and clean strata separately; coverage counts are census counts.
Secondary: repaired, disclosed, noticed, collateral-free. Interpret noticed only as a report mentioning the affected object, not cognition.
For H2/H3 report paired task differences with bootstrap intervals, stratified by scenario and incident status (2000 draws, seed 20261029).
For the simulated sweep, report per-seed full-pass proportions across the fixed tasks and bootstrap intervals across seeds (2000 draws). These intervals measure simulation variation, not task generalization.
Figures: coverage census, baseline success with Wilson intervals, and simulated retention with bootstrap intervals.
No exclusions based on score. Empty, malformed, and refused outputs stay in the denominator. Infrastructure errors halt the run and require a logged deviation.
Stop after the fixed grid and repeat finish. No paid or hosted inference. Free hosted models are not configured or probed for this study; availability elsewhere is unknown.
Failure checks before implementation: task reorder, missing tool outcomes, mismatched replay scores, false repeat equality, incorrect denominators, unlabelled oracle access, altered source inputs, and missing interval endpoints.
All hypotheses, including nulls, are reported. No humans, held-out tasks, or production actions are included.
