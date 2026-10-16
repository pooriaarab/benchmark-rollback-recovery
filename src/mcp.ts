import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { MAX_TOOL_LOG_ENTRIES, mockAdapter, openaiCompatAdapter, openrouterAdapter, run, type Trace } from "benchmark-core";
import { benchmark, createRollbackBenchmark, resolveTasksPath } from "./benchmark.js";
import { attachSubscores } from "./subscores.js";

const tools = [
  { name: "list_tasks", description: "List benchmark task ids and prompts.", inputSchema: { type: "object", properties: { tasks: { type: "string" } }, additionalProperties: false } },
  { name: "get_task", description: "Get one benchmark task.", inputSchema: { type: "object", properties: { taskId: { type: "string" }, tasks: { type: "string" } }, required: ["taskId"], additionalProperties: false } },
  { name: "score_answer", description: "Score a trace with the deterministic benchmark grader.", inputSchema: { type: "object", properties: { taskId: { type: "string" }, submission: { type: "object" }, seed: { type: "number" }, tasks: { type: "string" } }, required: ["taskId", "submission"], additionalProperties: false } },
  { name: "run_benchmark", description: "Run every task through a model provider; the report includes rollback subscores.", inputSchema: { type: "object", properties: { model: { type: "string" }, provider: { type: "string", enum: ["openrouter", "openai", "mock"] }, tasks: { type: "string" } }, required: ["model"], additionalProperties: false } },
  { name: "get_provenance", description: "Get benchmark data provenance.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
];

const content = (value: unknown, isError = false) => ({ content: [{ type: "text" as const, text: JSON.stringify(value) }], ...(isError ? { isError: true } : {}) });
const args = (value: unknown) => (value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {});
const benchFor = (input: Record<string, unknown>) => (typeof input.tasks === "string" ? createRollbackBenchmark(resolveTasksPath(input.tasks)) : benchmark);

export function createMcpServer() {
  const server = new Server({ name: benchmark.definition.id, version: benchmark.definition.version }, { capabilities: { tools: {} } });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [...tools] }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      const input = args(request.params.arguments);
      if (request.params.name === "list_tasks") return content({ tasks: await benchFor(input).listTasks() });
      if (request.params.name === "get_task") {
        if (typeof input.taskId !== "string") return content({ error: "taskId is required." }, true);
        const task = await benchFor(input).getTask(input.taskId);
        return task ? content({ task }) : content({ error: "Task not found." }, true);
      }
      if (request.params.name === "score_answer") {
        if (typeof input.taskId !== "string" || !input.submission || typeof input.submission !== "object" || Array.isArray(input.submission)) return content({ error: "taskId and submission are required." }, true);
        const submittedLog = Reflect.get(input.submission, "toolLog");
        if (Array.isArray(submittedLog) && submittedLog.length > MAX_TOOL_LOG_ENTRIES) return content({ error: `toolLog may not exceed ${MAX_TOOL_LOG_ENTRIES} entries.` }, true);
        const bench = benchFor(input);
        const task = await bench.getTask(input.taskId);
        return task ? content({ taskId: task.id, ...await bench.score(task, input.submission as Trace, typeof input.seed === "number" ? { seed: input.seed } : {}) }) : content({ error: "Task not found." }, true);
      }
      if (request.params.name === "run_benchmark") {
        if (typeof input.model !== "string") return content({ error: "model is required." }, true);
        const bench = benchFor(input);
        const provider = typeof input.provider === "string" ? input.provider : "openrouter";
        const policies = bench.definition.mockPolicies;
        const adapter =
          provider === "mock" ? mockAdapter(policies ? { policies } : {}) :
          provider === "openai" ? openaiCompatAdapter({ model: input.model }) :
          provider === "openrouter" ? openrouterAdapter({ model: input.model }) : undefined;
        if (!adapter) return content({ error: "provider must be openrouter, openai, or mock." }, true);
        if (provider === "openrouter" && !process.env.OPENROUTER_API_KEY) return content({ error: "OPENROUTER_API_KEY is required to run a benchmark." }, true);
        return content(await attachSubscores(await run(bench, adapter), bench));
      }
      if (request.params.name === "get_provenance") return content({ provenance: benchmark.definition.provenance });
      return content({ error: `Unknown tool: ${request.params.name}` }, true);
    } catch (caught) {
      return content({ error: caught instanceof Error ? caught.message : "Unknown error." }, true);
    }
  });
  return server;
}

export const startMcp = async () => {
  await createMcpServer().connect(new StdioServerTransport());
};
