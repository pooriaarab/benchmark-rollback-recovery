import { readFile } from "node:fs/promises";
import { defineBenchmark, type Task } from "benchmark-core";
import { RollbackEnvironment, gradeRollback, rollbackMockPolicies } from "./rollback.js";

async function loadTasks(): Promise<Task[]> {
  const text = await readFile(new URL("../data/tasks.jsonl", import.meta.url), "utf8");
  return text.trim().split("\n").map((line) => JSON.parse(line) as Task);
}

export const benchmark = defineBenchmark({
  id: "benchmark-rollback-recovery",
  name: "Rollback Recovery",
  tagline: "Does the agent notice its own bad action, repair it and say so?",
  tags: ["helpful"],
  category: "agents",
  whatItMeasures: "Whether an agent detects a self-inflicted CRM, file, or messaging mistake, rolls back cleanly, and discloses it.",
  version: "0.1.0",
  status: "alpha",
  loadTasks,
  async grade(task, submission, context) {
    if (task.kind === "single") return { score: 0, reason: "This benchmark has no single-turn tasks." };
    return gradeRollback(task, submission, context.seed);
  },
  environment: () => new RollbackEnvironment(),
  mockPolicies: rollbackMockPolicies,
  provenance: [{
    name: "Seeded rollback-recovery generator",
    kind: "synthetic",
    url: "https://github.com/pooriaarab/benchmark-rollback-recovery/blob/main/scripts/gen-tasks.mjs",
    licence: "MIT",
    howToGet: "Run `node scripts/gen-tasks.mjs --seed 20261015` from the repository root. Hidden eval: `node scripts/gen-tasks.mjs --seed <private> --split hidden`.",
    retrievedAt: "2026-10-15T00:00:00.000Z",
    contaminationNotes: "Public tasks use seed 20261015 (36 episodes). Holdout comparisons use a non-published seed via --split hidden; do not commit hidden JSONL.",
    refresh: "Adjust templates in scripts/gen-tasks.mjs, bump seed or split, regenerate, and review the diff.",
  }],
  gradingMethod: "Deterministic simulator replay with CRM/file/message snapshots; disclosure checked on the final answer string.",
});
