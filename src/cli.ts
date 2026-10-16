#!/usr/bin/env node
import { parseArgs } from "node:util";
import { createCli, mockAdapter, openaiCompatAdapter, openrouterAdapter, renderMarkdown, run } from "benchmark-core";
import { benchmark } from "./benchmark.js";
import { attachSubscores, formatSubscores } from "./subscores.js";

async function runCommand(argv: string[]): Promise<number> {
  const json = argv.includes("--json");
  const args = argv.filter((arg) => arg !== "--json");
  const parsed = parseArgs({
    args,
    options: {
      model: { type: "string" }, provider: { type: "string" }, concurrency: { type: "string" },
      timeout: { type: "string" }, retries: { type: "string" }, seed: { type: "string" },
      "max-turns": { type: "string" }, "max-tool-calls": { type: "string" }, budget: { type: "string" },
    },
    strict: true,
  });
  const model = parsed.values.model;
  const provider = parsed.values.provider;
  if (!model || !provider) {
    console.error("run needs --model and --provider.");
    return 1;
  }
  const seed = Number(parsed.values.seed ?? 1);
  const policies = benchmark.definition.mockPolicies;
  const adapter =
    provider === "mock" ? mockAdapter({ seed, ...(policies ? { policies } : {}) }) :
    provider === "openrouter" ? openrouterAdapter({ model }) :
    provider === "openai" ? openaiCompatAdapter({ model }) : undefined;
  if (!adapter) {
    console.error("--provider must be openrouter, openai, or mock.");
    return 1;
  }
  const report = await attachSubscores(await run(benchmark, adapter, {
    ...(parsed.values.concurrency ? { concurrency: Number(parsed.values.concurrency) } : {}),
    ...(parsed.values.timeout ? { timeoutMs: Number(parsed.values.timeout) } : {}),
    ...(parsed.values.retries ? { retries: Number(parsed.values.retries) } : {}),
    seed,
    ...(parsed.values["max-turns"] ? { maxTurns: Number(parsed.values["max-turns"]) } : {}),
    ...(parsed.values["max-tool-calls"] ? { maxToolCalls: Number(parsed.values["max-tool-calls"]) } : {}),
    ...(parsed.values.budget ? { budgetUsd: Number(parsed.values.budget) } : {}),
  }));
  console.log(json ? JSON.stringify(report) : `${renderMarkdown(report)}${formatSubscores(report)}`);
  return report.rows.some((row) => row.error) ? 2 : 0;
}

const argv = process.argv.slice(2);
process.exitCode = argv[0] === "run"
  ? await runCommand(argv.slice(1))
  : await createCli(benchmark, { bin: "benchmark-rollback-recovery" }).main(argv);
