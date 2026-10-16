import { createHandler, type Task } from "benchmark-core";
import { benchmark, createRollbackBenchmark, resolveTasksPath, sanitizeServedTask } from "./benchmark.js";

const sanitizePayload = (value: unknown): unknown => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return value;
  const record = { ...(value as Record<string, unknown>) };
  if (Array.isArray(record.tasks)) record.tasks = record.tasks.map((task) => sanitizeServedTask(task as Task));
  if (record.task && typeof record.task === "object" && !Array.isArray(record.task)) record.task = sanitizeServedTask(record.task as Task);
  return record;
};

export function createApiHandler(options: { tasks?: string } = {}) {
  const tasks = options.tasks ?? (typeof process !== "undefined" ? process.env?.RRB_TASKS_FILE : undefined);
  const bench = tasks ? createRollbackBenchmark(resolveTasksPath(tasks)) : benchmark;
  const inner = createHandler(bench);
  return async (request: Request): Promise<Response> => {
    const response = await inner(request);
    const url = new URL(request.url);
    if (request.method !== "GET" || !response.ok || (url.pathname !== "/v1/tasks" && !url.pathname.startsWith("/v1/tasks/"))) return response;
    return new Response(JSON.stringify(sanitizePayload(await response.json())), { status: response.status, headers: response.headers });
  };
}

export const handler = createApiHandler();
