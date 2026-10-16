#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { bootstrapCI, createCli, mockAdapter, openaiCompatAdapter, openrouterAdapter, renderMarkdown, run, serve } from "benchmark-core";
import type { Benchmark, RunReport, Task } from "benchmark-core";
import { createApiHandler } from "./api.js";
import { benchmark, createRollbackBenchmark } from "./benchmark.js";
import { startMcp } from "./mcp.js";
import { attachSubscores, formatSubscores } from "./subscores.js";

type Parsed = ReturnType<typeof parseArgs>;

function pickBench(parsed: Parsed): Benchmark<Task> {
  const tasks = parsed.values.tasks;
  return typeof tasks === "string" ? createRollbackBenchmark(tasks) : benchmark;
}

function isUsageError(error: unknown): boolean {
  const code = error !== null && typeof error === "object" ? Reflect.get(error, "code") : undefined;
  return typeof code === "string" && code.startsWith("ERR_PARSE_ARGS");
}

async function runCommand(argv: string[]): Promise<number> {
  const json = argv.includes("--json");
  const parsed = parseArgs({
    args: argv.filter((arg) => arg !== "--json"),
    options: {
      model: { type: "string" }, provider: { type: "string" }, concurrency: { type: "string" },
      timeout: { type: "string" }, retries: { type: "string" }, seed: { type: "string" },
      "max-turns": { type: "string" }, "max-tool-calls": { type: "string" }, budget: { type: "string" },
      tasks: { type: "string" },
    },
    strict: true,
  });
  const model = parsed.values.model;
  const provider = parsed.values.provider;
  if (!model || !provider) {
    console.error("run needs --model and --provider.");
    return 1;
  }
  const bench = pickBench(parsed);
  const seed = Number(parsed.values.seed ?? 1);
  const policies = bench.definition.mockPolicies;
  const adapter =
    provider === "mock" ? mockAdapter({ seed, ...(policies ? { policies } : {}) }) :
    provider === "openrouter" ? openrouterAdapter({ model }) :
    provider === "openai" ? openaiCompatAdapter({ model }) : undefined;
  if (!adapter) {
    console.error("--provider must be openrouter, openai, or mock.");
    return 1;
  }
  const report = await attachSubscores(await run(bench, adapter, {
    ...(parsed.values.concurrency ? { concurrency: Number(parsed.values.concurrency) } : {}),
    ...(parsed.values.timeout ? { timeoutMs: Number(parsed.values.timeout) } : {}),
    ...(parsed.values.retries ? { retries: Number(parsed.values.retries) } : {}),
    seed,
    ...(parsed.values["max-turns"] ? { maxTurns: Number(parsed.values["max-turns"]) } : {}),
    ...(parsed.values["max-tool-calls"] ? { maxToolCalls: Number(parsed.values["max-tool-calls"]) } : {}),
    ...(parsed.values.budget ? { budgetUsd: Number(parsed.values.budget) } : {}),
  }), bench);
  console.log(json ? JSON.stringify(report) : `${renderMarkdown(report)}${formatSubscores(report)}`);
  return report.rows.some((row) => row.error) ? 2 : 0;
}

async function scoreCommand(argv: string[]): Promise<number> {
  const json = argv.includes("--json");
  const parsed = parseArgs({
    args: argv.filter((arg) => arg !== "--json"),
    options: { tasks: { type: "string" } },
    allowPositionals: true,
    strict: true,
  });
  const file = parsed.positionals[0];
  if (!file) {
    console.error("score needs a results JSON file.");
    return 1;
  }
  const original = JSON.parse(await readFile(file, "utf8")) as RunReport;
  if (!Array.isArray(original?.rows)) {
    console.error("File is not a run report.");
    return 1;
  }
  const bench = pickBench(parsed);
  const rows = [];
  for (const row of original.rows) {
    const task = await bench.getTask(row.taskId);
    if (!task || row.submission === undefined) {
      console.error(`Cannot score task ${row.taskId}.`);
      return 1;
    }
    const grade = await bench.score(task, row.submission, { seed: original.seed });
    rows.push({ ...row, score: grade.score, reason: grade.reason });
  }
  const scores = rows.map((row) => row.score);
  const rescored = { ...original, rows, mean: scores.reduce((a, b) => a + b, 0) / scores.length, confidenceInterval95: bootstrapCI(scores, original.seed) };
  console.log(json ? JSON.stringify(rescored) : renderMarkdown(rescored));
  return 0;
}

async function serveCommand(argv: string[]): Promise<number> {
  const json = argv.includes("--json");
  const parsed = parseArgs({
    args: argv.filter((arg) => arg !== "--json"),
    options: { host: { type: "string" }, tasks: { type: "string" } },
    allowPositionals: true,
    strict: true,
  });
  if (parsed.positionals.length > 1) {
    console.error("serve accepts at most one port.");
    return 1;
  }
  const port = Number(parsed.positionals[0] ?? process.env.PORT ?? 3000);
  const hostname = parsed.values.host ?? "127.0.0.1";
  if (!Number.isInteger(port) || port < 0 || port > 65535 || !hostname.trim()) {
    console.error("serve needs a valid port and --host.");
    return 1;
  }
  await serve(createApiHandler(typeof parsed.values.tasks === "string" ? { tasks: parsed.values.tasks } : {}), { port, hostname });
  console.log(json ? JSON.stringify({ listening: port, host: hostname }) : `Listening on http://${hostname}:${port}`);
  return 0;
}

const argv = process.argv.slice(2);
try {
  process.exitCode = argv[0] === "run"
    ? await runCommand(argv.slice(1))
    : argv[0] === "score"
      ? await scoreCommand(argv.slice(1))
      : argv[0] === "serve"
        ? await serveCommand(argv.slice(1))
        : argv[0] === "mcp"
          ? await startMcp().then(() => 0)
          : await createCli(benchmark, { bin: "benchmark-rollback-recovery" }).main(argv);
} catch (caught) {
  console.error(caught instanceof Error ? caught.message : String(caught));
  process.exitCode = isUsageError(caught) ? 1 : 2;
}
