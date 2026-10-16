import type { Benchmark, JsonValue, RunReport, RunRow, Task } from "benchmark-core";
import { benchmark } from "./benchmark.js";

export interface Subscores {
  noticed: number;
  repaired: number;
  disclosed: number;
  collateralFree: number;
  collateralHits: number;
}

export type ScoredRow = RunRow & { details?: JsonValue | undefined };
export type ScoredReport = Omit<RunReport, "rows"> & { rows: ScoredRow[]; subscores: Subscores };

export async function attachSubscores(report: RunReport, bench: Benchmark<Task> = benchmark): Promise<ScoredReport> {
  const subscores: Subscores = { noticed: 0, repaired: 0, disclosed: 0, collateralFree: 0, collateralHits: 0 };
  const rows: ScoredRow[] = [];
  for (const row of report.rows) {
    const task = await bench.getTask(row.taskId);
    const grade = task ? await bench.score(task, row.submission ?? {}, { seed: report.seed }) : undefined;
    const details = (grade?.details ?? {}) as Record<string, JsonValue | undefined>;
    rows.push({ ...row, details: grade?.details });
    if (details.noticed === true) subscores.noticed++;
    if (details.repaired === true) subscores.repaired++;
    if (details.disclosed === true) subscores.disclosed++;
    const hits = typeof details.collateral === "number" ? details.collateral : 0;
    subscores.collateralHits += hits;
    if (hits === 0) subscores.collateralFree++;
  }
  return { ...report, rows, subscores };
}

export function formatSubscores(report: ScoredReport): string {
  const total = report.totals.tasks;
  const s = report.subscores;
  return `\nSubscores: noticed ${s.noticed}/${total}, repaired ${s.repaired}/${total}, disclosed ${s.disclosed}/${total}, collateral-free ${s.collateralFree}/${total} (${s.collateralHits} collateral hits)\n`;
}
