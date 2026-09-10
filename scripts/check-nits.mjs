// Runs idnits over the RFCXML and fails on anything actually wrong with it.
//
// Run: node scripts/check-nits.mjs [path-to-xml]
//
// idnits' "submission" mode is the one the Datatracker runs, but it is narrow:
// deleting the whole Security Considerations section still passes it. So this
// gates on "normal" mode, which catches that and is otherwise a strict
// superset -- the filename and docname checks submission mode is usually
// credited with are in it too.
//
// Normal mode reports one error that is wrong about this document rather than
// wrong in it, excused below by code. Everything else fails the build.
//
// Warnings and comments are printed but never gate. The two that stand are
// deliberate: evil.arpa is what Section 13 asks IANA for, and Section 2.1's
// RFC 6919 key words are left untagged on purpose, because <bcp14> holds
// BCP 14's own words only.
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
// Defaults to the draft; takes a path so the gate itself can be tested.
const DOC = process.argv[2] ?? join(ROOT, "draft-traviss-evil-byte-00.xml");

const EXCLUDED_ERRORS = {
  INVALID_REFERENCES_NAME:
    "idnits (sections.mjs) iterates only the top-level <references> elements and never recurses, so it reads a nested Normative/Informative pair as one section misnamed \"References\". The nesting is correct: RFC 9401 and RFC 9110 are both structured this way, outer <name>References</name> included, and it is what makes the document render 14, 14.1 and 14.2 as its own table of contents promises.",
};

const cli = join(ROOT, "node_modules", "@ietf-tools", "idnits", "cli.js");
const args = ["-m", "normal", "--no-color", "--no-progress", "-o", "json", DOC];
const run = spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });
if (run.error) throw run.error;

let report;
try {
  report = JSON.parse(run.stdout);
} catch {
  console.error(`idnits produced no parseable JSON (exit ${run.status}).`);
  console.error(run.stdout || run.stderr);
  process.exit(2);
}

const label = { ValidationError: "error", ValidationWarning: "warning", ValidationComment: "comment" };
const bySeverity = { ValidationError: [], ValidationWarning: [], ValidationComment: [] };
for (const nit of report.nits) (bySeverity[nit.severity] ??= []).push(nit);

for (const [severity, nits] of Object.entries(bySeverity)) {
  if (!nits.length) continue;
  const counts = new Map();
  for (const n of nits) counts.set(n.code, (counts.get(n.code) ?? 0) + 1);
  console.log(`\n${label[severity]}s (${nits.length}):`);
  for (const [code, n] of [...counts].sort()) {
    console.log(`  ${code}${n > 1 ? ` x${n}` : ""} -- ${nits.find((x) => x.code === code).desc}`);
  }
}

const errors = bySeverity.ValidationError ?? [];
const excused = errors.filter((n) => n.code in EXCLUDED_ERRORS);
const failures = errors.filter((n) => !(n.code in EXCLUDED_ERRORS));

if (excused.length) {
  console.log("\nExcused (known idnits limitation):");
  for (const code of new Set(excused.map((n) => n.code))) {
    console.log(`  ${code}\n    ${EXCLUDED_ERRORS[code]}`);
  }
}

if (failures.length) {
  console.log(`\nFAIL: ${failures.length} unexcused error(s):`);
  for (const n of failures) console.log(`  ${n.code}: ${n.desc}`);
  process.exit(1);
}

console.log(`\nPASS: no unexcused idnits errors.`);
