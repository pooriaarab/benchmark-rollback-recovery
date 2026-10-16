import { run as runBenchmark, type ModelAdapter, type RunOptions, type Trace } from "benchmark-core";
import { benchmark, createRollbackBenchmark } from "./benchmark.js";
import { attachSubscores } from "./subscores.js";
export { benchmark, createRollbackBenchmark };
export { RollbackEnvironment, ACTION_TAKEN, WHAT_HAPPENED } from "./rollback.js";
export type { IncidentReport, RollbackInput } from "./rollback.js";
export type { ScoredReport, ScoredRow, Subscores } from "./subscores.js";
export interface RollbackRunOptions extends RunOptions { tasks?: string }
export const run = async (adapter: ModelAdapter, options?: RollbackRunOptions) => {
  const { tasks, ...rest } = options ?? {};
  const bench = tasks ? createRollbackBenchmark(tasks) : benchmark;
  return attachSubscores(await runBenchmark(bench, adapter, rest), bench);
};
export async function score(taskId: string, submission: Trace, options?: { tasks?: string }) {
  const bench = options?.tasks ? createRollbackBenchmark(options.tasks) : benchmark;
  const task = await bench.getTask(taskId); if (!task) throw new Error(`Task not found: ${taskId}`);
  return bench.score(task, submission);
}
