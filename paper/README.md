# Rollback Recovery paper

Install Node 22, npm 10, Python 3, Tectonic, and Poppler. From the repository root, run:

```sh
npm ci
sh paper/template/reproduce.sh
```

The output is `paper/rollback-recovery-paper.pdf`. PDFs, TeX logs, and downloaded styles remain untracked.
The unchanged accepted pilot `template/` pins the official NeurIPS style archive. Initial compilation can download TeX dependencies.
Experiments use local scripted controls and a simulated report-retention sweep. No inference service or credential is used.
The study freezes source commit `ca4058d1903df96c52c02206b60806881240a0e5`. The family paper lists this benchmark as 48 synthetic episodes at version 0.1.0.
`PREREG.md` is committed before outcomes. It is a local plan, not an independently registered study.
The runner extracts the existing visible-information reference policy from `scripts/e2e.mjs`; provenance records that file's hash.
The fixture oracle reads answers. It is labelled separately from visible recovery. Every altered trace is replayed through the public scorer.
Generated JSON contains runner reports, tool observations, repeat hashes, simulation decisions, component intervals, and source hashes.
The verifier replays all baseline and simulated grades and checks metadata, repeat agreement, and PDF text. Repeats do not increase task sample size.
Wilson intervals assume hypothetical task sampling. Paired bootstraps preserve scenario and incident strata. Simulated intervals resample agents over fixed tasks.
The paper and generated figures use CC-BY-4.0. Software and tasks retain MIT. No human study or learned-model score is claimed.
Free inference is not configured or probed. No publication, submission, or merge is part of this packet.
The existing package E2E gate expects npm 10 pack output. npm 12 returns a different JSON shape and fails that gate.
