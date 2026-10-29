import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { benchmark } from '../../dist/index.js';
import { mean, wilson, bootstrap } from '../template/stats.mjs';
const read = name => JSON.parse(readFileSync(`paper/data/${name}.generated.json`)), hash = x => createHash('sha256').update(x).digest('hex');
const runs = read('runs'), repeats = read('repeat'), summary = read('summary'), simulation = read('simulation'), tasks = await benchmark.listTasks();
const semantic = r => r.rows.map(({ taskId, submission, score, reason, details }) => ({ taskId, submission, score, reason, details }));
let rows = 0;
for (const [i, { policy, report }] of runs.entries()) {
  assert.equal(repeats[i].policy, policy); assert.deepEqual(semantic(report), semantic(repeats[i].repeat)); assert.equal(hash(JSON.stringify(semantic(report))), repeats[i].sha256); assert.equal(repeats[i].sha256, repeats[i].repeatSha256);
  const expected = summary.stats.find(s => s.policy === policy);
  for (const r of report.rows) { const grade = await benchmark.score(await benchmark.getTask(r.taskId), r.submission, { seed: 1 }); assert.deepEqual({ score: grade.score, reason: grade.reason, details: grade.details }, { score: r.score, reason: r.reason, details: r.details }); rows++; }
  for (const key of ['full','incident','clean']) { const selected = report.rows.filter((r,j) => key === 'full' || (!!tasks[j].input.incident === (key === 'incident'))); assert.deepEqual(wilson(selected.filter(r => r.score === 1).length, selected.length), expected[key]); }
  for (const key of ['noticed','repaired','disclosed','collateralFree']) assert.deepEqual(wilson(report.rows.filter(r => key === 'collateralFree' ? r.details.collateral === 0 : r.details[key]).length, tasks.length), expected.components[key]);
}
const reference = runs.find(r => r.policy === 'visible').report.rows;
for (const r of simulation) {
  const source = reference.find(x => x.taskId === r.taskId), keep = parseInt(hash(`${r.seed}:${r.taskId}`).slice(0, 8), 16) / 2 ** 32 < r.retention;
  assert.equal(r.keep, keep); assert.equal(r.simulated, true);
  const grade = await benchmark.score(await benchmark.getTask(r.taskId), { ...source.submission, toolLog: source.submission.toolLog.filter(c => c.name !== 'report_incident' || keep) }, { seed: 1 });
  assert.equal(grade.score, r.score); assert.deepEqual(grade.details, r.details);
}
for (const cell of summary.simulation) { const selected = simulation.filter(r => r.retention === cell.retention); assert.equal(selected.length, cell.episodes); const agents = Array.from({ length: cell.agents }, (_,i) => mean(selected.filter(r => r.seed === i+1).map(r => r.score))); assert.deepEqual(bootstrap([agents], gs => mean(gs[0])), cell.success); assert.equal(selected.filter(r => r.score === 1).length, cell.passes); }
for (const contrast of summary.contrasts) {
  const actual = runs.find(r => r.policy === contrast.policy).report.rows.map((r,i) => ({ delta: r.score - reference[i].score, task: tasks[i] }));
  const groups = ['crm','file','message'].flatMap(s => [true,false].map(incident => actual.filter(r => r.task.input.scenario === s && !!r.task.input.incident === incident)));
  assert.deepEqual(bootstrap(groups, gs => mean(gs.flat().map(r => r.delta))), contrast.difference);
}
const tagged = runs.find(r => r.policy === 'no-tags').report.rows;
assert.ok(tagged.filter((r,i) => tasks[i].input.scenario === 'message').every(r => r.score === 1));
assert.ok(tagged.some(r => r.observations.some(o => o.outcome.error?.code === 'STALE_STATE')));
const provenance = read('provenance'); for (const [p,digest] of Object.entries(provenance.files)) assert.equal(hash(readFileSync(p)), digest);
assert.equal(hash(readFileSync('paper/data/runs.generated.json')), provenance.run_hash);
assert.equal(execFileSync('git', ['show', `${provenance.prereg_commit}:paper/PREREG.md`], { encoding: 'utf8' }), readFileSync('paper/PREREG.md','utf8'));
const meta = JSON.parse(readFileSync('paper/meta.json')), cff = readFileSync('CITATION.cff','utf8');
assert.ok(meta.abstract.length <= 1920 && /^[\x00-\x7f]*$/.test(meta.abstract)); assert.ok(cff.includes(meta.title) && cff.includes(meta.authors[0].orcid));
const pdf = `paper/${meta.artifact_name}`, text = execFileSync('pdftotext',[pdf,'-'],{encoding:'utf8'}), pages = +execFileSync('pdfinfo',[pdf],{encoding:'utf8'}).match(/Pages:\s+(\d+)/)[1];
assert.ok(pages >= 8); assert.ok(text.includes('Caveats') && text.includes('Authors') && text.includes('simulated') && !text.includes('??') && !text.includes('\u2014'));
writeFileSync('paper/data/verification.generated.json', JSON.stringify({ replayedBaselineRows: rows, replayedSimulatedRows: simulation.length, repeatedConditions: repeats.length, rawSummaryAgreement: true, staleStateObserved: true, metadataMatches: true, pdfTextChecks: true, pages, pdfSha256: hash(readFileSync(pdf)) },null,2)+'\n');
console.log(`Verified ${rows} baseline grades, ${simulation.length} simulated grades, ${repeats.length} repeated conditions, and ${pages} PDF pages`);
