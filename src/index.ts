import { run as runBenchmark, type ModelAdapter, type RunOptions, type Trace } from "benchmark-core";
import { benchmark } from "./benchmark.js";
import { attachSubscores } from "./subscores.js";
export { benchmark };
export { RollbackEnvironment } from "./rollback.js";
export type { ScoredReport, ScoredRow, Subscores } from "./subscores.js";
export const run = async (adapter: ModelAdapter, options?: RunOptions) => attachSubscores(await runBenchmark(benchmark, adapter, options));
export async function score(taskId: string, submission: Trace) {
  const task = await benchmark.getTask(taskId); if (!task) throw new Error(`Task not found: ${taskId}`);
  return benchmark.score(task, submission);
}
