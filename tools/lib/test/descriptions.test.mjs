/**
 * Tests for the Bogaziçi undergraduate-catalogue parsers
 * (tools/lib/parse-descriptions.mjs), run against recorded fixtures.
 */

import test from "node:test";
import assert from "assert/strict";

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import {
  parseCatalogIndex,
  parseCatalogDepartment,
} from "../parse-descriptions.mjs";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "fixtures");

const indexHtml = await readFile(path.join(FIXTURES, "katalog-index.html"), "utf8");
const cmpeHtml = await readFile(path.join(FIXTURES, "katalog-cmpe.html"), "utf8");

test("parseCatalogIndex finds at least 30 programme links", () => {
  const entries = parseCatalogIndex(indexHtml);
  assert.ok(entries.length >= 30, `expected >=30 entries, got ${entries.length}`);
});

test("parseCatalogIndex includes Computer Engineering with id=55", () => {
  const entries = parseCatalogIndex(indexHtml);
  const cmpe = entries.find((e) => e.id === "55");
  assert.ok(cmpe, "no entry with id 55");
  assert.match(cmpe.name, /Bilgisayar/);
});

test("parseCatalogIndex entry shape", () => {
  for (const entry of parseCatalogIndex(indexHtml)) {
    assert.equal(typeof entry.id, "string");
    assert.match(entry.id, /^\d+$/);
    assert.equal(typeof entry.name, "string");
    assert.ok(entry.name.length > 0);
  }
});

test("parseCatalogDepartment extracts CMPE150 correctly", () => {
  const courses = parseCatalogDepartment(cmpeHtml);
  const cmpe150 = courses["CMPE150"];
  assert.ok(cmpe150, "CMPE150 missing");
  assert.equal(cmpe150.title, "Introduction to Computing");
  assert.equal(cmpe150.credits, "3");
  assert.equal(cmpe150.ects, "5");
  assert.match(cmpe150.description, /^The aim of the course is twofold/);
  assert.equal(cmpe150.prerequisite, null);
});

test("parseCatalogDepartment CMPE210 has a filled description", () => {
  const courses = parseCatalogDepartment(cmpeHtml);
  const cmpe210 = courses["CMPE210"];
  assert.ok(cmpe210, "CMPE210 missing");
  assert.equal(cmpe210.credits, "4");
  assert.equal(cmpe210.ects, "5");
  assert.ok(cmpe210.description.length > 0, "empty description");
  assert.equal(cmpe210.prerequisite, "CMPE 150.");
});

test("parseCatalogDepartment captures at least 20 course entries", () => {
  const courses = parseCatalogDepartment(cmpeHtml);
  assert.ok(
    Object.keys(courses).length >= 20,
    `expected >=20 entries, got ${Object.keys(courses).length}`
  );
});

test("parseCatalogDepartment keys are spaceless course codes", () => {
  for (const key of Object.keys(parseCatalogDepartment(cmpeHtml))) {
    assert.match(key, /^[A-Z]{2,5}\d{3}[A-Z]?$/);
  }
});

test("parseCatalogDepartment tolerates other-department codes (TK221-style)", () => {
  // The page may list service courses from other departments; that is fine.
  const courses = parseCatalogDepartment(cmpeHtml);
  const other = Object.keys(courses).filter((k) => !k.startsWith("CMPE"));
  for (const key of other) {
    assert.ok(courses[key].title.length > 0);
  }
});

test("parseCatalogDepartment returns {} for empty HTML", () => {
  assert.deepEqual(parseCatalogDepartment(""), {});
});

test("parseCatalogIndex returns [] for empty HTML", () => {
  assert.deepEqual(parseCatalogIndex(""), []);
});
