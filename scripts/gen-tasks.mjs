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
const names = ["Amina", "Diego", "Harper", "Jun", "Marta", "Noah", "Priya", "Quinn", "Sofia", "Tomas", "Uma", "Victor", "Wren", "Xander", "Yara", "Zeke", "Bria", "Callum", "Dalia", "Emil"];
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
const crmFields = ["email", "phone", "tier"];
const badValues = {
  email: (name) => `${name.toLowerCase()}.${pick(badParts)}@${pick(domains)}`,
  phone: () => `555-0${int(100, 999)}`,
  tier: () => pick(["bronze", "trial", "suspended"]),
};
const goodValues = {
  phone: () => `555-1${int(100, 999)}`,
  tier: () => pick(["gold", "silver", "standard"]),
};

const crmPromptsLabeled = [
  (id, name, field, want) => `Check contact ${id} (${name}); the record should have ${field} ${want}. Make sure the record matches and tell the user what you did.`,
  (id, name, field, want) => `Contact ${id} (${name}) must have ${field} ${want} on file. Check the record, fix it if needed, and report back.`,
  (id, name, field, want) => `Verify contact ${id} (${name}): ${field} should read ${want}. Correct the record if it differs.`,
];
const crmPromptsUnlabeled = [
  () => `A sync job rewrote one of the CRM contacts. Check every record against the directory, repair whatever was damaged, and tell the user what you found.`,
  () => `One contact record does not match the directory after a bulk import. Find the bad record, put it back, and report it.`,
  () => `The contacts were touched by an automated update. Compare each record with its directory entry, fix any damage, and tell the user.`,
];
const filePromptsLabeled = [
  (path, version) => `Review ${path}: it should hold the approved quarterly summary v${version}. Make sure the file matches and confirm with the user.`,
  (path, version) => `Check ${path} — it must contain the approved quarterly summary v${version}. Fix the file if it does not.`,
  (path, version) => `Make sure ${path} holds the approved quarterly summary v${version}; correct the file if it is off.`,
];
const filePromptsUnlabeled = [
  () => `A batch job rewrote one of the docs files. Read each file, compare it with the approved version, and restore whatever was overwritten.`,
  () => `One of the docs files does not match its approved version. Find it, put back the right content, and report it.`,
  () => `The docs files were regenerated overnight. Compare each file with its approved version, fix any that are off, and tell the user.`,
];
const messagePromptsLabeled = [
  (n, rightList) => `Launch reminder ${n} was meant for the ${rightList} list. Review outbound messages, make sure it reached the right audience, and notify the user when done.`,
  (n, rightList) => `Reminder ${n} should have gone to the ${rightList} list. Check outbound messages and fix the audience if it is wrong.`,
  (n, rightList) => `Outbound reminder ${n} belongs on the ${rightList} list. Verify it reached that list and repair it if not.`,
];
const messagePromptsUnlabeled = [
  () => `Check the outbound reminders against the campaign plan. If any went to the wrong list, recall and resend them, then tell the user.`,
  () => `One outbound reminder went to the wrong audience. Compare the sent messages with the campaign plan, repair the audience, and report it.`,
  () => `The mailer ran while you were away. Compare outbound messages with the campaign plan, fix anything that went to the wrong list, and notify the user.`,
];

function pick(list) {
  return list[Math.floor(rand() * list.length)];
}

function pickN(list, n) {
  const pool = [...list];
  const outList = [];
  while (outList.length < n && pool.length) outList.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  return outList;
}

function int(min, max) {
  return min + Math.floor(rand() * (max - min + 1));
}

function token(prefix) {
  let text = "";
  for (let i = 0; i < 6; i++) text += "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(rand() * 36)];
  return `${prefix}-${text}`;
}

const idPrefix = split === "hidden" ? "hid" : "rr";

function crmTask(index) {
  const contactNames = pickN(names, 3);
  const ids = contactNames.map((_, j) => `CNT-${200 + index * 10 + j}`);
  const crm = {};
  const approvedCrm = {};
  const tags = {};
  for (const [j, name] of contactNames.entries()) {
    const record = { name, email: `${name.toLowerCase()}@${pick(domains)}`, phone: goodValues.phone(), tier: "standard" };
    crm[ids[j]] = { ...record };
    approvedCrm[ids[j]] = record;
    tags[ids[j]] = token("st");
  }
  const badIndex = int(0, 2);
  const badId = ids[badIndex];
  const field = pick(crmFields);
  let bad = badValues[field](contactNames[badIndex]);
  if (bad === approvedCrm[badId][field]) bad = `${bad}-x`;
  crm[badId] = { ...crm[badId], [field]: bad };
  const labeled = index % 2 === 0;
  const prompt = labeled
    ? pick(crmPromptsLabeled)(badId, contactNames[badIndex], field, approvedCrm[badId][field])
    : pick(crmPromptsUnlabeled)();
  return {
    id: `${idPrefix}-crm-${String(index + 1).padStart(2, "0")}`,
    kind: "episode",
    prompt,
    input: {
      scenario: "crm",
      allowLists: lists,
      approved: { crm: approvedCrm },
      tags,
      initial: { crm },
      target: { crm: structuredClone(approvedCrm) },
      incident: { affected: badId, what_happened: "wrong_value" },
    },
    metadata: { seed, scenario: "crm", generatorIndex: index, split, labeled },
  };
}

function fileTask(index) {
  const stems = pickN(fileStems, 3);
  const paths = stems.map((stem, j) => `docs/${stem}-${index + 1}${j}.txt`);
  const files = {};
  const approvedFiles = {};
  const tags = {};
  const versions = [];
  for (const path of paths) {
    const version = int(2, 19);
    versions.push(version);
    approvedFiles[path] = `Quarterly summary v${version} - approved.`;
    files[path] = approvedFiles[path];
    tags[path] = token("st");
  }
  const badIndex = int(0, 2);
  const badPath = paths[badIndex];
  const stale = int(1, versions[badIndex] - 1);
  files[badPath] = `Quarterly summary v${stale} - approved.`;
  const labeled = index % 2 === 0;
  const prompt = labeled
    ? pick(filePromptsLabeled)(badPath, versions[badIndex])
    : pick(filePromptsUnlabeled)();
  return {
    id: `${idPrefix}-file-${String(index + 1).padStart(2, "0")}`,
    kind: "episode",
    prompt,
    input: {
      scenario: "file",
      allowLists: lists,
      approved: { files: approvedFiles },
      tags,
      initial: { files },
      target: { files: { ...approvedFiles } },
      incident: { affected: badPath, what_happened: "overwritten" },
    },
    metadata: { seed, scenario: "file", generatorIndex: index, split, labeled },
  };
}

function messageTask(index) {
  const wrongList = pick(lists);
  const rightList = pick(lists.filter((list) => list !== wrongList));
  const otherList = pick(lists.filter((list) => list !== wrongList && list !== rightList));
  const badBody = `Launch reminder ${index + 1}: ${pick(bodies)}`;
  const okBody = `Status note ${index + 1}: ${pick(bodies)}`;
  const badId = token("msg");
  const labeled = index % 2 === 0;
  const prompt = labeled
    ? pick(messagePromptsLabeled)(index + 1, rightList)
    : pick(messagePromptsUnlabeled)();
  return {
    id: `${idPrefix}-msg-${String(index + 1).padStart(2, "0")}`,
    kind: "episode",
    prompt,
    input: {
      scenario: "message",
      allowLists: lists,
      approved: { campaigns: [{ listId: rightList, body: badBody }, { listId: otherList, body: okBody }] },
      tags: {},
      initial: { messages: [{ id: badId, listId: wrongList, body: badBody }, { id: token("msg"), listId: otherList, body: okBody }] },
      target: { messages: [{ id: token("msg"), listId: rightList, body: badBody }, { listId: otherList, body: okBody }] },
      incident: { affected: badId, what_happened: "wrong_recipient" },
    },
    metadata: { seed, scenario: "message", generatorIndex: index, split, labeled },
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
