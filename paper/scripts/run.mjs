import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { benchmark, run, RollbackEnvironment } from '../../dist/index.js';
import { mockAdapter } from 'benchmark-core';
import { mean, wilson, bootstrap } from '../template/stats.mjs';
const hash = x => createHash('sha256').update(x).digest('hex');
export const save = (name, x) => writeFileSync(`paper/data/${name}.generated.json`, JSON.stringify(x, null, 2) + '\n');
const config = JSON.parse(readFileSync('paper/config.json')), tasks = await benchmark.listTasks();
const e2e = readFileSync('scripts/e2e.mjs', 'utf8');
const visible = new Function('assert', `${e2e.slice(e2e.indexOf('function visiblePolicy('), e2e.indexOf('\nfunction toolLogFromCalls'))}; return visiblePolicy;`)(assert);
const options = { seed: 1, concurrency: 1, retries: 0, maxTurns: 40, maxToolCalls: 100, budgetUsd: 0 };
const policies = ['empty', 'constant', 'echo', 'refuse', 'first-tool', 'packaged-good', 'packaged-bad'];
const mutations = new Set(['update_record', 'correct_record', 'write_file', 'restore', 'send_message', 'undo_send']);
const semantic = r => r.rows.map(({ taskId, submission, score, reason, details }) => ({ taskId, submission, score, reason, details }));
function adapter(policy) {
  if (policy.startsWith('packaged-')) { const script = benchmark.definition.mockPolicies[policy.slice(9)]; return mockAdapter({ seed: 1, policies: { good: script, bad: script } }); }
  return { id: `script:${policy}`, complete: async () => { throw Error('Episode expected'); }, async chat({ messages, tools }) {
    if (policy === 'first-tool' && !messages.some(m => m.role === 'tool')) return { content: '', toolCalls: [{ id: 'first', name: tools[0].name, args: {} }] };
    return { content: ({ empty: '', constant: 'OK', echo: messages.find(m => m.role === 'user').content, refuse: 'I cannot help.', 'first-tool': '' })[policy], toolCalls: [] };
  } };
}
async function replay(task, submission) {
  const env = new RollbackEnvironment(); await env.reset(task, 1);
  const observations = (submission.toolLog ?? []).map(c => ({ ...c, outcome: env.callTool(c.name, c.args) }));
  return { taskId: task.id, submission, observations, finalState: env.state(), ...await benchmark.score(task, submission, { seed: 1 }) };
}
async function direct(policy) {
  const rows = [];
  for (const task of tasks) {
    const env = new RollbackEnvironment(), start = await env.reset(task, 1), solved = visible(env, start.system, task.prompt);
    let toolLog = solved.toolLog;
    if (policy === 'no-report') toolLog = toolLog.filter(c => c.name !== 'report_incident');
    if (policy === 'no-tags') toolLog = toolLog.map(c => ({ ...c, args: Object.fromEntries(Object.entries(c.args).filter(([k]) => k !== 'stateTag')) }));
    if (policy === 'no-repair') toolLog = toolLog.filter(c => !mutations.has(c.name));
    rows.push(await replay(task, { toolLog, answer: solved.answer }));
  }
  return { rows };
}
mkdirSync('paper/data', { recursive: true });
const runs = [], repeats = [];
for (const policy of [...policies, 'visible', 'no-report', 'no-tags', 'no-repair']) {
  const execute = () => policies.includes(policy) ? run(adapter(policy), options) : direct(policy);
  const report = await execute(), repeat = await execute();
  for (const r of [report, repeat]) { assert.deepEqual(r.rows.map(x => x.taskId), tasks.map(t => t.id)); assert.ok(r.rows.every(x => !x.error)); assert.equal(r.totals?.costUsd ?? 0, 0); }
  assert.deepEqual(semantic(report), semantic(repeat));
  runs.push({ policy, report }); repeats.push({ policy, sha256: hash(JSON.stringify(semantic(report))), repeatSha256: hash(JSON.stringify(semantic(repeat))), repeat });
}
save('runs', runs); save('repeat', repeats);
const groups = rows => ['crm', 'file', 'message'].flatMap(s => [true, false].map(incident => rows.filter((r, i) => tasks[i].input.scenario === s && !!tasks[i].input.incident === incident)));
const rate = (rows, f) => wilson(rows.filter(f).length, rows.length);
const stats = runs.map(({ policy, report: { rows } }) => ({ policy, full: rate(rows, r => r.score === 1), incident: rate(rows.filter((r,i) => tasks[i].input.incident), r => r.score === 1), clean: rate(rows.filter((r,i) => !tasks[i].input.incident), r => r.score === 1), components: Object.fromEntries(['noticed', 'repaired', 'disclosed', 'collateralFree'].map(k => [k, rate(rows, r => k === 'collateralFree' ? r.details.collateral === 0 : r.details[k])])) }));
const reference = runs.find(r => r.policy === 'visible').report.rows;
const contrasts = runs.filter(r => r.policy.startsWith('no-')).map(({ policy, report: { rows } }) => ({ policy, difference: bootstrap(groups(rows.map((r,i) => ({ delta: r.score - reference[i].score }))), gs => mean(gs.flat().map(r => r.delta))) }));
const sweep = [];
for (const retention of [0, .25, .5, .75, 1]) for (let seed = 1; seed <= 100; seed++) for (const [i, task] of tasks.entries()) {
  const u = parseInt(hash(`${seed}:${task.id}`).slice(0, 8), 16) / 2 ** 32, keep = u < retention;
  const submission = { ...reference[i].submission, toolLog: reference[i].submission.toolLog.filter(c => c.name !== 'report_incident' || keep) };
  sweep.push({ simulated: true, retention, seed, taskId: task.id, keep, ...await benchmark.score(task, submission, { seed: 1 }) });
}
save('simulation', sweep);
const simulation = [0, .25, .5, .75, 1].map(retention => { const rows = sweep.filter(r => r.retention === retention); const agents = Array.from({ length: 100 }, (_, i) => mean(rows.filter(r => r.seed === i + 1).map(r => r.score))); return { simulated: true, retention, agents: agents.length, success: bootstrap([agents], gs => mean(gs[0])), passes: rows.filter(r => r.score === 1).length, episodes: rows.length }; });
const coverage = ['crm', 'file', 'message'].map(scenario => ({ scenario, incidents: tasks.filter(t => t.input.scenario === scenario && t.input.incident).length, clean: tasks.filter(t => t.input.scenario === scenario && !t.input.incident).length }));
save('summary', { tasks: tasks.length, incidents: tasks.filter(t => t.input.incident).length, clean: tasks.filter(t => !t.input.incident).length, coverage, stats, contrasts, simulation, options, baselineEpisodes: tasks.length * runs.length * 2, simulatedEpisodes: sweep.length, costUsd: 0, ciLevel: 95, freeModels: 'Not configured or probed; availability elsewhere unknown.' });
const sources = ['data/tasks.jsonl', 'package-lock.json', 'src/rollback.ts', 'src/benchmark.ts', 'src/index.ts', 'scripts/e2e.mjs'];
for (const p of sources) assert.equal(hash(readFileSync(p)), hash(execFileSync('git', ['show', `${config.source_commit}:${p}`])));
save('provenance', { source_commit: config.source_commit, prereg_commit: execFileSync('git', ['log', '--reverse', '--format=%H', '--', 'paper/PREREG.md'], { encoding: 'utf8' }).trim().split('\n')[0], node: process.version, files: Object.fromEntries([...sources, 'paper/PREREG.md', 'paper/scripts/run.mjs', 'paper/template/stats.mjs'].map(p => [p, hash(readFileSync(p))])), run_hash: hash(readFileSync('paper/data/runs.generated.json')) });
console.log(`${runs.length} controls repeated; ${sweep.length} simulated episodes; API cost USD 0`);
