import { createHandler } from "benchmark-core";
import { benchmark, createRollbackBenchmark, resolveTasksPath } from "./benchmark.js";

export function createApiHandler(options: { tasks?: string } = {}) {
  const tasks = options.tasks ?? (typeof process !== "undefined" ? process.env?.RRB_TASKS_FILE : undefined);
  const bench = tasks ? createRollbackBenchmark(resolveTasksPath(tasks)) : benchmark;
  return createHandler(bench);
}

export const handler = createApiHandler();
