import test from "node:test";
import assert from "node:assert/strict";
import { baseCode, isPlaceholderInstructor } from "../../../src/lib/courseKey.mjs";

test("baseCode strips the section suffix from a plain key", () => {
  assert.equal(baseCode("CMPE150.01"), "CMPE150");
  assert.equal(baseCode("MATH101.09"), "MATH101");
});

test("baseCode strips the internal padding the registrar emits", () => {
  // Real cells: the site pads department codes ("EC  101.02", "AD 211.01").
  assert.equal(baseCode("AD 211.01"), "AD211");
  assert.equal(baseCode("EC  101.02"), "EC101");
});

test("baseCode discards LAB / P.S. sub-row suffixes", () => {
  // 309 of the 3140 keys in 2026-2027-1 deviate from <DEPT><NUM>.<SEC>.
  assert.equal(baseCode("AD251.01 P.S. 1"), "AD251");
  assert.equal(baseCode("CMPE150.01 LAB 2"), "CMPE150");
});

test("baseCode keeps a letter suffix that is part of the course number", () => {
  assert.equal(baseCode("AD48L.01"), "AD48L");
  assert.equal(baseCode("PHYS101L.03"), "PHYS101L");
});

test("baseCode is idempotent on an already-bare code", () => {
  assert.equal(baseCode("CMPE150"), "CMPE150");
  assert.equal(baseCode(baseCode("AD251.01 P.S. 1")), "AD251");
});

test("STAFF STAFF is the placeholder instructor the registrar actually ships", () => {
  // Measured: the only placeholder string across all 25 term files (979 sections).
  assert.equal(isPlaceholderInstructor("STAFF STAFF"), true);
  assert.equal(isPlaceholderInstructor("staff"), true);
  assert.equal(isPlaceholderInstructor("TBA"), true);
  assert.equal(isPlaceholderInstructor("BELİRTİLMEDİ"), true);
  assert.equal(isPlaceholderInstructor("-"), true);
});

test("a blank instructor cell counts as a placeholder", () => {
  assert.equal(isPlaceholderInstructor(""), true);
  assert.equal(isPlaceholderInstructor("   "), true);
  assert.equal(isPlaceholderInstructor(undefined), true);
  assert.equal(isPlaceholderInstructor(null), true);
});

test("real names containing a placeholder substring are not placeholders", () => {
  // Both exist in the archive; a substring test would have suppressed them.
  assert.equal(isPlaceholderInstructor("CEREN ABI MC GREEVY STAFFORD"), false);
  assert.equal(isPlaceholderInstructor("EKREM KUTBAY"), false);
  assert.equal(isPlaceholderInstructor("GÜZİN GÜLSÜN AKIN"), false);
});

test("a partly-named section is a real name, not a placeholder", () => {
  // Every token must be a placeholder, so one real token is enough.
  assert.equal(isPlaceholderInstructor("STAFF AKIN"), false);
});
