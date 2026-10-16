import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { defineBenchmark, type Task } from "benchmark-core";
import { RollbackEnvironment, gradeRollback, rollbackMockPolicies } from "./rollback.js";

export async function loadTasksFrom(tasksPath: string | URL): Promise<Task[]> {
  const text = await readFile(tasksPath, "utf8");
  return text.trim().split("\n").map((line) => JSON.parse(line) as Task);
}

export const PACKAGE_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));

function taskAllowList(): string[] {
  const raw = typeof process !== "undefined" ? process.env?.RRB_TASKS_ALLOW : undefined;
  return (raw ?? "").split(":").filter(Boolean).map((entry) => resolve(entry));
}

export function resolveTasksPath(requested: string): string {
  const absolute = resolve(requested);
  const inside = absolute === PACKAGE_ROOT || absolute.startsWith(`${PACKAGE_ROOT}${sep}`);
  const allowed = taskAllowList().some((entry) => absolute === entry || absolute.startsWith(`${entry}${sep}`));
  if (!inside && !allowed) throw new Error(`Tasks path ${requested} is outside the package and not in RRB_TASKS_ALLOW.`);
  return absolute;
}

const DEFAULT_TASKS = new URL("../data/tasks.jsonl", import.meta.url);

export function createRollbackBenchmark(tasksPath?: string) {
  return defineBenchmark({
    id: "benchmark-rollback-recovery",
    name: "Rollback Recovery",
    tagline: "Does the agent notice its own bad action, repair it and say so?",
    tags: ["helpful"],
    category: "agents",
    whatItMeasures: "Whether an agent detects a self-inflicted CRM, file, or messaging mistake, rolls back cleanly, and discloses it.",
    version: "0.1.0",
    status: "alpha",
    loadTasks: () => loadTasksFrom(tasksPath ?? DEFAULT_TASKS),
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
      howToGet: "Run `node scripts/gen-tasks.mjs --seed 20261015` from the repository root. Hidden eval: `node scripts/gen-tasks.mjs --seed <private> --split hidden` writes data/hidden/tasks.jsonl with hid-* ids; run it via `run --tasks`, the SDK `tasks` option, or the API allow-list.",
      retrievedAt: "2026-10-15T00:00:00.000Z",
      contaminationNotes: "Public tasks use seed 20261015 (36 episodes). Holdout comparisons use a non-published seed via --split hidden; hidden task ids carry the hid- prefix so reports cannot confuse the two splits; do not commit hidden JSONL.",
      refresh: "Adjust templates in scripts/gen-tasks.mjs, bump seed or split, regenerate, and review the diff.",
    }],
    gradingMethod: "Deterministic simulator replay with CRM/file/message snapshots; disclosure checked on the last typed report_incident tool call, not free text.",
  });
}

export const benchmark = createRollbackBenchmark();
