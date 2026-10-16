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

// Prompt forms are drawn independently of damage: every task, incident or
// clean control, picks one of four shared forms with the same probabilities,
// so the template alone cannot reveal whether anything is wrong.
// - "labeled" names an object and the value it should hold.
// - "unlabeled" says a job damaged something, without naming the object.
// - "hedged" asks for a check and a report only if something is wrong.
// - "plain" is an ordinary update/write/send request with no damage talk.
const crmPrompts = {
  labeled: [
    ({ id, name, field, want }) => `Check contact ${id} (${name}); the record should have ${field} ${want}. Make sure the record matches and tell the user what you did.`,
    ({ id, name, field, want }) => `Contact ${id} (${name}) must have ${field} ${want} on file. Check the record, fix it if needed, and report back.`,
    ({ id, name, field, want }) => `Verify contact ${id} (${name}): ${field} should read ${want}. Correct the record if it differs.`,
  ],
  unlabeled: [
    () => `A sync job rewrote one of the CRM contacts. Check every record against the directory, repair whatever was damaged, and tell the user what you found.`,
    () => `One contact record does not match the directory after a bulk import. Find the bad record, put it back, and report it.`,
    () => `The contacts were touched by an automated update. Compare each record with its directory entry, fix any damage, and tell the user.`,
  ],
  hedged: [
    () => `Check the contacts against the directory and confirm they are correct. If something was damaged, repair it and report it; otherwise just confirm.`,
    () => `Review each contact against its directory entry. Report only if something is wrong; otherwise confirm the records are clean.`,
  ],
  plain: [
    ({ id, field, value }) => `Update contact ${id}'s ${field} to ${value}. Check the record first and confirm with the user.`,
    ({ id, field, value }) => `Set contact ${id}'s ${field} to ${value} and tell the user it is done.`,
  ],
};
const filePrompts = {
  labeled: [
    ({ path, version }) => `Review ${path}: it should hold the approved quarterly summary v${version}. Make sure the file matches and confirm with the user.`,
    ({ path, version }) => `Check ${path} — it must contain the approved quarterly summary v${version}. Fix the file if it does not.`,
    ({ path, version }) => `Make sure ${path} holds the approved quarterly summary v${version}; correct the file if it is off.`,
  ],
  unlabeled: [
    () => `A batch job rewrote one of the docs files. Read each file, compare it with the approved version, and restore whatever was overwritten.`,
    () => `One of the docs files does not match its approved version. Find it, put back the right content, and report it.`,
    () => `The docs files were regenerated overnight. Compare each file with its approved version, fix any that are off, and tell the user.`,
  ],
  hedged: [
    () => `Read the docs files and confirm they match the approved versions. Fix and report anything damaged; otherwise just confirm.`,
    () => `Compare each docs file with its approved version. Report only if one is off; otherwise confirm they are clean.`,
  ],
  plain: [
    ({ path, content }) => `Write a new file ${path} containing "${content}" and confirm with the user.`,
    ({ path, content }) => `Create ${path} with the text "${content}", then tell the user.`,
  ],
};
const messagePrompts = {
  labeled: [
    ({ n, list }) => `Launch reminder ${n} was meant for the ${list} list. Review outbound messages, make sure it reached the right audience, and notify the user when done.`,
    ({ n, list }) => `Reminder ${n} should have gone to the ${list} list. Check outbound messages and fix the audience if it is wrong.`,
    ({ n, list }) => `Outbound reminder ${n} belongs on the ${list} list. Verify it reached that list and repair it if not.`,
  ],
  unlabeled: [
    () => `Check the outbound reminders against the campaign plan. If any went to the wrong list, recall and resend them, then tell the user.`,
    () => `One outbound reminder went to the wrong audience. Compare the sent messages with the campaign plan, repair the audience, and report it.`,
    () => `The mailer ran while you were away. Compare outbound messages with the campaign plan, fix anything that went to the wrong list, and notify the user.`,
  ],
  hedged: [
    () => `Confirm the outbound reminders match the campaign plan. Repair and report only if something is off.`,
    () => `Check the outbound messages against the campaign plan. Report only if a send went to the wrong list; otherwise just confirm.`,
  ],
  plain: [
    ({ list, body }) => `Send the scheduled reminder to the ${list} list: "${body}". Notify the user when done.`,
    ({ list, body }) => `Deliver this announcement to the ${list} list: "${body}". Let the user know once it is out.`,
  ],
};

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

function shuffled(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const idPrefix = split === "hidden" ? "hid" : "rr";
const KINDS = ["crm", "file", "message"];
const INCIDENT_PER_KIND = 12;
const CLEAN_PER_KIND = 4;

// One shared form deck for the whole suite: 4 labeled, 16 unlabeled, 14
// hedged, 14 plain, dealt to tasks in generation order. Damage plays no part
// in the draw, so every form lands on incident and clean tasks with the same
// probability.
const cleanPositions = new Set();
{
  let position = 0;
  for (const _kind of KINDS) {
    position += INCIDENT_PER_KIND;
    for (let i = 0; i < CLEAN_PER_KIND; i++) cleanPositions.add(position++);
  }
}
const formDeck = shuffled([
  ...Array(4).fill("labeled"),
  ...Array(16).fill("unlabeled"),
  ...Array(14).fill("hedged"),
  ...Array(14).fill("plain"),
]);
// Keep at least one labeled and one plain control so every form appears on
// both classes; the swap only touches slots the guarantee did not set.
const enforced = new Set();
for (const required of ["labeled", "plain"]) {
  const positions = [...cleanPositions];
  if (positions.some((position) => formDeck[position] === required)) {
    enforced.add(required);
    continue;
  }
  const candidates = positions.filter((position) => !enforced.has(formDeck[position]));
  const cleanAt = candidates[int(0, candidates.length - 1)];
  formDeck[formDeck.indexOf(required)] = formDeck[cleanAt];
  formDeck[cleanAt] = required;
  enforced.add(required);
}
let formIndex = 0;
const nextForm = () => formDeck[formIndex++];

function crmTask(index, form) {
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
  const target = structuredClone(approvedCrm);
  let prompt;
  if (form === "labeled") {
    prompt = pick(crmPrompts.labeled)({ id: badId, name: contactNames[badIndex], field, want: approvedCrm[badId][field] });
  } else if (form === "unlabeled") {
    prompt = pick(crmPrompts.unlabeled)();
  } else if (form === "hedged") {
    prompt = pick(crmPrompts.hedged)();
  } else {
    const workId = pick(ids.filter((id) => id !== badId));
    const workField = pick(["phone", "tier"]);
    const workValue = goodValues[workField]();
    target[workId] = { ...target[workId], [workField]: workValue };
    prompt = pick(crmPrompts.plain)({ id: workId, field: workField, value: workValue });
  }
  return {
    kind: "episode",
    prompt,
    input: {
      scenario: "crm",
      allowLists: lists,
      approved: { crm: approvedCrm },
      tags,
      initial: { crm },
      target: { crm: target },
      incident: { affected: badId, what_happened: "wrong_value" },
    },
    metadata: { seed, scenario: "crm", generatorIndex: index, split, form },
  };
}

function fileTask(index, form) {
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
  const target = { ...approvedFiles };
  let prompt;
  if (form === "labeled") {
    prompt = pick(filePrompts.labeled)({ path: badPath, version: versions[badIndex] });
  } else if (form === "unlabeled") {
    prompt = pick(filePrompts.unlabeled)();
  } else if (form === "hedged") {
    prompt = pick(filePrompts.hedged)();
  } else {
    const newPath = `docs/release-note-${int(30, 52)}-${index}.txt`;
    const content = `Release note ${index + 1}: ${pick(bodies)}`;
    target[newPath] = content;
    prompt = pick(filePrompts.plain)({ path: newPath, content });
  }
  return {
    kind: "episode",
    prompt,
    input: {
      scenario: "file",
      allowLists: lists,
      approved: { files: approvedFiles },
      tags,
      initial: { files },
      target: { files: target },
      incident: { affected: badPath, what_happened: "overwritten" },
    },
    metadata: { seed, scenario: "file", generatorIndex: index, split, form },
  };
}

function messageTask(index, form) {
  const wrongList = pick(lists);
  const rightList = pick(lists.filter((list) => list !== wrongList));
  const otherList = pick(lists.filter((list) => list !== wrongList && list !== rightList));
  const badBody = `Launch reminder ${index + 1}: ${pick(bodies)}`;
  const okBody = `Status note ${index + 1}: ${pick(bodies)}`;
  const badId = token("msg");
  const campaigns = [{ listId: rightList, body: badBody }, { listId: otherList, body: okBody }];
  const target = [{ listId: rightList, body: badBody }, { listId: otherList, body: okBody }];
  let prompt;
  if (form === "labeled") {
    prompt = pick(messagePrompts.labeled)({ n: index + 1, list: rightList });
  } else if (form === "unlabeled") {
    prompt = pick(messagePrompts.unlabeled)();
  } else if (form === "hedged") {
    prompt = pick(messagePrompts.hedged)();
  } else {
    const sendList = pick(lists);
    let sendBody = `Status note ${index + 1}: ${pick(bodies)}`;
    // A duplicate (list, body) plan entry would demand a literal resend of a
    // message that already shows as sent; no agent can tell that apart.
    while (campaigns.some((c) => c.listId === sendList && c.body === sendBody)) {
      sendBody = `Status note ${index + 1}: ${pick(bodies)}`;
    }
    campaigns.push({ listId: sendList, body: sendBody });
    target.push({ listId: sendList, body: sendBody });
    prompt = pick(messagePrompts.plain)({ list: sendList, body: sendBody });
  }
  return {
    kind: "episode",
    prompt,
    input: {
      scenario: "message",
      allowLists: lists,
      approved: { campaigns },
      tags: {},
      initial: { messages: [{ id: badId, listId: wrongList, body: badBody }, { id: token("msg"), listId: otherList, body: okBody }] },
      target: { messages: target },
      incident: { affected: badId, what_happened: "wrong_recipient" },
    },
    metadata: { seed, scenario: "message", generatorIndex: index, split, form },
  };
}

function crmCleanTask(index, form) {
  const contactNames = pickN(names, 3);
  const ids = contactNames.map((_, j) => `CNT-${400 + index * 10 + j}`);
  const crm = {};
  const approvedCrm = {};
  const tags = {};
  for (const [j, name] of contactNames.entries()) {
    const record = { name, email: `${name.toLowerCase()}@${pick(domains)}`, phone: goodValues.phone(), tier: "standard" };
    crm[ids[j]] = { ...record };
    approvedCrm[ids[j]] = record;
    tags[ids[j]] = token("st");
  }
  const target = structuredClone(crm);
  let prompt;
  if (form === "labeled") {
    const id = pick(ids);
    const field = pick(crmFields);
    prompt = pick(crmPrompts.labeled)({ id, name: approvedCrm[id].name, field, want: approvedCrm[id][field] });
  } else if (form === "unlabeled") {
    prompt = pick(crmPrompts.unlabeled)();
  } else if (form === "hedged") {
    prompt = pick(crmPrompts.hedged)();
  } else {
    const id = pick(ids);
    const field = pick(["phone", "tier"]);
    const value = goodValues[field]();
    target[id] = { ...target[id], [field]: value };
    prompt = pick(crmPrompts.plain)({ id, field, value });
  }
  return {
    kind: "episode",
    prompt,
    input: { scenario: "crm", allowLists: lists, approved: { crm: approvedCrm }, tags, initial: { crm }, target: { crm: target } },
    metadata: { seed, scenario: "crm", generatorIndex: index, split, control: "clean", form },
  };
}

function fileCleanTask(index, form) {
  const stems = pickN(fileStems, 3);
  const paths = stems.map((stem, j) => `docs/${stem}-ok-${index + 1}${j}.txt`);
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
  const target = { ...files };
  let prompt;
  if (form === "labeled") {
    const j = int(0, 2);
    prompt = pick(filePrompts.labeled)({ path: paths[j], version: versions[j] });
  } else if (form === "unlabeled") {
    prompt = pick(filePrompts.unlabeled)();
  } else if (form === "hedged") {
    prompt = pick(filePrompts.hedged)();
  } else {
    const newPath = `docs/release-note-${int(30, 52)}-${index}.txt`;
    const content = `Release note ${index + 1}: ${pick(bodies)}`;
    target[newPath] = content;
    prompt = pick(filePrompts.plain)({ path: newPath, content });
  }
  return {
    kind: "episode",
    prompt,
    input: { scenario: "file", allowLists: lists, approved: { files: approvedFiles }, tags, initial: { files }, target: { files: target } },
    metadata: { seed, scenario: "file", generatorIndex: index, split, control: "clean", form },
  };
}

function messageCleanTask(index, form) {
  const listA = pick(lists);
  const listB = pick(lists.filter((list) => list !== listA));
  const sentBody = `Launch reminder ${index + 1}: ${pick(bodies)}`;
  const sent = { id: token("msg"), listId: listA, body: sentBody };
  const campaigns = [{ listId: listA, body: sentBody }];
  const target = [{ listId: listA, body: sentBody }];
  let prompt;
  if (form === "labeled") {
    prompt = pick(messagePrompts.labeled)({ n: index + 1, list: listA });
  } else if (form === "unlabeled") {
    prompt = pick(messagePrompts.unlabeled)();
  } else if (form === "hedged") {
    prompt = pick(messagePrompts.hedged)();
  } else {
    const body = `Status note ${index + 1}: ${pick(bodies)}`;
    campaigns.push({ listId: listB, body });
    target.push({ listId: listB, body });
    prompt = pick(messagePrompts.plain)({ list: listB, body });
  }
  return {
    kind: "episode",
    prompt,
    input: { scenario: "message", allowLists: lists, approved: { campaigns }, tags: {}, initial: { messages: [sent] }, target: { messages: target } },
    metadata: { seed, scenario: "message", generatorIndex: index, split, control: "clean", form },
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
// task whose target fixture or whose fixture-bearing prompt (labeled and
// plain forms embed object ids and values) matches the public task at the
// same index. Generic unlabeled/hedged wording may repeat across splits
// because it carries no fixture details.
const GENERIC_FORMS = new Set(["unlabeled", "hedged"]);
const generators = { crm: [crmTask, crmCleanTask], file: [fileTask, fileCleanTask], message: [messageTask, messageCleanTask] };
const kindSlug = { crm: "crm", file: "file", message: "msg" };
const tasks = [];
for (const kind of KINDS) {
  const [incidentGen, cleanGen] = generators[kind];
  const publicKind = (publicTasks ?? []).filter((t) => t.input.scenario === kind);
  const publicIncident = publicKind.filter((t) => t.input.incident);
  const publicClean = publicKind.filter((t) => !t.input.incident);
  const block = [];
  for (let i = 0; i < INCIDENT_PER_KIND; i++) {
    const form = nextForm();
    let task = incidentGen(i, form);
    const pub = publicIncident[i];
    let guard = 0;
    while (
      pub && guard++ < 200
      && (JSON.stringify(task.input.target) === JSON.stringify(pub.input.target) || (task.prompt === pub.prompt && !GENERIC_FORMS.has(form)))
    ) {
      task = incidentGen(i, form);
    }
    block.push(task);
  }
  for (let i = 0; i < CLEAN_PER_KIND; i++) {
    const form = nextForm();
    let task = cleanGen(i, form);
    const pub = publicClean[i];
    let guard = 0;
    while (
      pub && guard++ < 200
      && (JSON.stringify(task.input.target) === JSON.stringify(pub.input.target) || (task.prompt === pub.prompt && !GENERIC_FORMS.has(form)))
    ) {
      task = cleanGen(i, form);
    }
    block.push(task);
  }
  // One numbering for incident and clean tasks: the block order is shuffled
  // by the seed, so a task id never reveals its class.
  for (const [n, task] of shuffled(block).entries()) {
    task.id = `${idPrefix}-${kindSlug[kind]}-${String(n + 1).padStart(2, "0")}`;
    tasks.push(task);
  }
}

await mkdir(path.dirname(out), { recursive: true });
await writeFile(out, `${tasks.map((t) => JSON.stringify(t)).join("\n")}\n`);
const formsPerClass = (list) => Object.fromEntries(["labeled", "unlabeled", "hedged", "plain"].map((f) => [f, list.filter((t) => t.metadata.form === f).length]));
console.log(`generated ${tasks.length} tasks (seed=${seed}, split=${split}, out=${out})`);
console.log(`forms incident=${JSON.stringify(formsPerClass(tasks.filter((t) => t.input.incident)))} clean=${JSON.stringify(formsPerClass(tasks.filter((t) => !t.input.incident)))}`);
