import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

function mulberry32(seed) {
  return function next() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PUBLIC_SEED = 20261015;

const args = process.argv.slice(2);
let seed = PUBLIC_SEED;
let split = "public";
let out = "data/tasks.jsonl";
let seedExplicit = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--seed" && args[i + 1]) {
    seed = Number(args[++i]);
    seedExplicit = true;
  }
  if (args[i] === "--split" && args[i + 1]) split = args[++i];
  if (args[i] === "--out" && args[i + 1]) out = args[++i];
}
if (split === "hidden" && !seedExplicit) {
  console.error("error: --split hidden requires an explicit --seed (not the default)");
  process.exit(1);
}
if (split === "hidden" && seed === PUBLIC_SEED) {
  console.error("error: --split hidden must not reuse the public seed");
  process.exit(1);
}
const publicTasksPath = path.resolve("data/tasks.jsonl");
let resolvedOut = path.resolve(out);
if (split === "hidden" && resolvedOut === publicTasksPath) {
  resolvedOut = path.resolve("data/hidden/tasks.jsonl");
}
out = resolvedOut;

const rand = mulberry32(seed);
const names = ["Amina", "Diego", "Harper", "Jun", "Marta", "Noah", "Priya", "Quinn", "Sofia", "Tomas", "Uma", "Victor", "Wren", "Xander", "Yara", "Zeke"];
const domains = ["example.com", "mail.test", "corp.local", "team.example", "hq.example.org", "post.example.net"];
const lists = ["team-updates", "beta-users", "all-staff", "alerts", "release-notes", "weekly-digest"];
const fileStems = ["note", "memo", "brief", "summary", "report", "ledger", "plan", "minutes", "draft", "agenda"];
const badParts = ["ops", "desk", "team", "admin", "office", "support", "news", "old"];
const bodies = [
  "please review the checklist.",
  "RSVP by Friday.",
  "read the changelog.",
  "confirm your seat.",
  "check the agenda.",
  "see the rollout notes.",
  "review the incident log.",
  "verify the shipping date.",
  "skim the survey results.",
  "confirm the maintenance window.",
  "check the staging link.",
  "acknowledge the policy update.",
];

const crmPrompts = [
  (id, name, email) => `Check contact ${id} (${name}); the record should have email ${email}. Make sure the record matches and tell the user what you did.`,
  (id, name, email) => `Contact ${id} (${name}) must have email ${email} on file. Check the record, fix it if needed, and report back.`,
  (id, name, email) => `Verify contact ${id} (${name}): email should read ${email}. Correct the record if it differs.`,
];
const filePrompts = [
  (path, version) => `Review ${path}: it should hold the approved quarterly summary v${version}. Make sure the file matches and confirm with the user.`,
  (path, version) => `Check ${path} — it must contain the approved quarterly summary v${version}. Fix the file if it does not.`,
  (path, version) => `Make sure ${path} holds the approved quarterly summary v${version}; correct the file if it is off.`,
];
const messagePrompts = [
  (n, rightList) => `Launch reminder ${n} was meant for the ${rightList} list. Review outbound messages, make sure it reached the right audience, and notify the user when done.`,
  (n, rightList) => `Reminder ${n} should have gone to the ${rightList} list. Check outbound messages and fix the audience if it is wrong.`,
  (n, rightList) => `Outbound reminder ${n} belongs on the ${rightList} list. Verify it reached that list and repair it if not.`,
];

function pick(list) {
  return list[Math.floor(rand() * list.length)];
}

function int(min, max) {
  return min + Math.floor(rand() * (max - min + 1));
}

const idPrefix = split === "hidden" ? "hid" : "rr";

function crmTask(index) {
  const id = `CNT-${100 + index}`;
  const name = pick(names);
  const nameStem = name.toLowerCase();
  const goodEmail = `${nameStem}@${pick(domains)}`;
  let badEmail = `${nameStem}.${pick(badParts)}@${pick(domains)}`;
  if (badEmail === goodEmail) badEmail = `${nameStem}2@${domains[0]}`;
  const pristine = { name, email: goodEmail, tier: "standard" };
  const target = { crm: { [id]: pristine } };
  const initial = { crm: { [id]: { ...pristine, email: badEmail } } };
  return {
    id: `${idPrefix}-crm-${String(index + 1).padStart(2, "0")}`,
    kind: "episode",
    prompt: pick(crmPrompts)(id, name, goodEmail),
    input: {
      scenario: "crm",
      allowLists: lists,
      pristine: { crm: { [id]: pristine } },
      initial,
      target,
      incident: { affected: id, what_happened: "wrong_value" },
    },
    metadata: { seed, scenario: "crm", generatorIndex: index, split },
  };
}

function fileTask(index) {
  const stem = pick(fileStems);
  const path = `docs/${stem}-${index + 1}.txt`;
  const version = int(2, 19);
  const stale = int(1, version - 1);
  const good = `Quarterly summary v${version} - approved.`;
  const bad = `Quarterly summary v${stale} - approved.`;
  return {
    id: `${idPrefix}-file-${String(index + 1).padStart(2, "0")}`,
    kind: "episode",
    prompt: pick(filePrompts)(path, version),
    input: {
      scenario: "file",
      allowLists: lists,
      pristine: { files: { [path]: good } },
      initial: { files: { [path]: bad } },
      target: { files: { [path]: good } },
      incident: { affected: path, what_happened: "overwritten" },
    },
    metadata: { seed, scenario: "file", generatorIndex: index, split },
  };
}

function messageTask(index) {
  const wrongList = pick(lists);
  const rightList = pick(lists.filter((list) => list !== wrongList));
  const body = `Launch reminder ${index + 1}: ${pick(bodies)}`;
  const wrongId = `msg-bad-${index}`;
  return {
    id: `${idPrefix}-msg-${String(index + 1).padStart(2, "0")}`,
    kind: "episode",
    prompt: pick(messagePrompts)(index + 1, rightList),
    input: {
      scenario: "message",
      allowLists: lists,
      pristine: {},
      initial: { messages: [{ id: wrongId, listId: wrongList, body }] },
      target: { messages: [{ id: `msg-ok-${index}`, listId: rightList, body }] },
      incident: { affected: wrongId, what_happened: "wrong_recipient" },
    },
    metadata: { seed, scenario: "message", generatorIndex: index, split },
  };
}

let publicTasks = null;
if (split === "hidden") {
  try {
    publicTasks = (await readFile(publicTasksPath, "utf8")).trim().split("\n").map((line) => JSON.parse(line));
  } catch {
    publicTasks = null;
  }
}

// Hidden tasks must be fully different from the public split: redraw any
// task whose prompt or target matches the public task at the same index.
const generators = { crm: crmTask, file: fileTask, message: messageTask };
const tasks = [];
for (const kind of ["crm", "file", "message"]) {
  const publicKind = (publicTasks ?? []).filter((t) => t.input.scenario === kind);
  for (let i = 0; i < 12; i++) {
    let task = generators[kind](i);
    const pub = publicKind[i];
    let guard = 0;
    while (pub && guard++ < 200 && (task.prompt === pub.prompt || JSON.stringify(task.input.target) === JSON.stringify(pub.input.target))) {
      task = generators[kind](i);
    }
    tasks.push(task);
  }
}

await mkdir(path.dirname(out), { recursive: true });
await writeFile(out, `${tasks.map((t) => JSON.stringify(t)).join("\n")}\n`);
console.log(`generated ${tasks.length} tasks (seed=${seed}, split=${split}, out=${out})`);
