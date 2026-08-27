/**
 * Tests for the prereqs.json data model: telling "scraped, no prerequisite"
 * apart from "never scraped".
 *
 * The old file was a flat map of course code → record, and 5778 of its 6937
 * entries were byte-identical `{prereqs:[],coreqs:[],consent:false,gpa:null}`.
 * That value is what `parsePrereqPage` returns for a genuine no-prerequisite
 * course AND for any page that is not a prerequisitecheck.asp answer at all, so
 * key-presence did not actually mean "we read the page". `isPrereqPage` closes
 * that hole and the reserved "meta" key records when the guarantee was refreshed.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import {
  PREREQS_META_KEY,
  derivePrereqsMeta,
  isPrereqPage,
  parsePrereqPage,
  serializePrereqsFile,
  splitPrereqsFile,
} from "../parse-prereqs.mjs";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");

/** @param {string} name */
function loadFixture(name) {
  return readFileSync(join(FIXTURES, name), "utf8");
}

test("isPrereqPage accepts every real page, including the empty one", () => {
  for (const name of [
    "prerequisitecheck-ec203.html", // has a prerequisite
    "prerequisitecheck-cmpe540.html", // consent of instructor
    "prerequisitecheck-cmpe150.html", // all three sections say "not Found"
  ]) {
    assert.equal(isPrereqPage(loadFixture(name)), true, name);
  }
});

test("isPrereqPage rejects bodies that are not prerequisite pages", () => {
  for (const html of [
    "<html><body>error</body></html>",
    "<html><head><title>Alert</title></head><body>rate limited</body></html>",
    "",
    // A partial page is rejected too: all three section markers are present on
    // every real answer, so a missing one is a layout change, not a variant.
    "<html><body><p>Course Prerequisites:</p></body></html>",
  ]) {
    assert.equal(isPrereqPage(html), false, JSON.stringify(html.slice(0, 40)));
  }
});

test("this is the exact hole isPrereqPage closes", () => {
  // A garbage page parses into the same record as a genuine no-prereq course…
  const garbage = parsePrereqPage("<html><body>error</body></html>");
  const genuine = parsePrereqPage(loadFixture("prerequisitecheck-cmpe150.html"));
  assert.deepEqual(garbage, genuine);
  // …so the two are only distinguishable before parsing.
  assert.equal(isPrereqPage("<html><body>error</body></html>"), false);
  assert.equal(isPrereqPage(loadFixture("prerequisitecheck-cmpe150.html")), true);
});

test("the three prereq states are distinguishable in the serialized file", () => {
  const courses = {
    CMPE210: { prereqs: ["CMPE150"], coreqs: [], consent: false, gpa: null },
    CMPE150: { prereqs: [], coreqs: [], consent: false, gpa: null },
  };
  const file = JSON.parse(
    serializePrereqsFile(courses, { scrapedAt: "2026-08-27T00:00:00.000Z", failed: 1 }),
  );
  const { meta, courses: parsed } = splitPrereqsFile(file);

  // 1. scraped, has prerequisites
  assert.deepEqual(parsed.CMPE210.prereqs, ["CMPE150"]);
  // 2. scraped, has none — present, and empty means empty because it is here
  assert.deepEqual(parsed.CMPE150.prereqs, []);
  // 3. never scraped — absent entirely
  assert.equal("CMPE220" in parsed, false);

  assert.deepEqual(meta, {
    scrapedAt: "2026-08-27T00:00:00.000Z",
    failed: 1,
    courses: 2,
  });
});

test("meta is written first and course keys stay sorted", () => {
  const json = serializePrereqsFile(
    { ZZ100: { prereqs: [] }, AA100: { prereqs: [] } },
    { scrapedAt: "2026-01-01T00:00:00.000Z", failed: 0 },
  );

  assert.deepEqual(Object.keys(JSON.parse(json)), [PREREQS_META_KEY, "AA100", "ZZ100"]);
  assert.ok(json.endsWith("\n"));
  // Two-space indent, matching the file already committed.
  assert.match(json, /^\{\n {2}"meta": \{\n {4}"scrapedAt"/);
});

test("splitPrereqsFile never leaks meta into the course records", () => {
  const stored = {
    meta: { scrapedAt: "x", failed: 0, courses: 1 },
    CMPE150: { prereqs: [] },
  };
  const { meta, courses } = splitPrereqsFile(stored);

  assert.equal(Object.keys(courses).length, 1);
  assert.equal(PREREQS_META_KEY in courses, false);
  assert.equal(meta?.courses, 1);
});

test("splitPrereqsFile reports null meta for a pre-migration file", () => {
  const { meta, courses } = splitPrereqsFile({ CMPE150: { prereqs: [] } });

  assert.equal(meta, null);
  assert.deepEqual(Object.keys(courses), ["CMPE150"]);
});

test("the migrated meta block is marked derived, not passed off as a crawl", () => {
  const meta = derivePrereqsMeta();

  assert.equal(meta.derived, true);
  assert.equal(meta.failed, 0);
  assert.ok(!Number.isNaN(Date.parse(meta.scrapedAt)));
});

test("a migration round-trip preserves every course record byte for byte", () => {
  const courses = {
    AA100: { prereqs: [], coreqs: [], consent: false, gpa: null },
    BB200: { prereqs: ["AA100"], coreqs: ["CC300"], consent: true, gpa: "3.00" },
  };
  const migrated = serializePrereqsFile(courses, derivePrereqsMeta());

  assert.deepEqual(splitPrereqsFile(JSON.parse(migrated)).courses, courses);
});

test("the reserved meta key can never collide with a course code", () => {
  // Course codes always carry digits, so "meta" is not a reachable key. Both
  // paths that could produce one are checked: the catalogue parser's own regex
  // shape and the code normalizer.
  assert.match(PREREQS_META_KEY, /^[a-z]+$/);
  assert.doesNotMatch(PREREQS_META_KEY, /^[A-Z]+\d{3,4}[A-Z]?$/);
});
