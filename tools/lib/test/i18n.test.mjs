import test from "node:test";
import assert from "node:assert/strict";

import { dict, lookup, interpolate, placeholders } from "../../../src/lib/i18nDict.mjs";

const LANGS = /** @type {const} */ (["en", "tr"]);

test("every key has a non-empty string in both languages", () => {
  const bad = [];
  for (const [key, entry] of Object.entries(dict)) {
    for (const lang of LANGS) {
      const value = entry[lang];
      if (typeof value !== "string" || value.trim() === "") {
        bad.push(`${key}.${lang}`);
      }
    }
  }
  assert.deepEqual(bad, []);
});

test("a missing key reports itself as missing and renders as the key", () => {
  const result = lookup("does.not.exist", "en");
  assert.equal(result.missing, true);
  assert.equal(result.text, "does.not.exist");
});

test("a present key is not reported missing and returns the requested language", () => {
  const en = lookup("course.eligible", "en");
  const tr = lookup("course.eligible", "tr");
  assert.equal(en.missing, false);
  assert.equal(tr.missing, false);
  assert.equal(en.text, "Eligible");
  assert.equal(tr.text, "Alınabilir");
  assert.notEqual(en.text, tr.text);
});

test("placeholders match across languages", () => {
  // A translation that drops a {placeholder} silently loses information the
  // English string promised, so the two sides must agree exactly.
  const mismatched = [];
  for (const [key, entry] of Object.entries(dict)) {
    const en = placeholders(entry.en);
    const tr = placeholders(entry.tr);
    if (en.join(",") !== tr.join(",")) {
      mismatched.push(`${key}: en=[${en}] tr=[${tr}]`);
    }
  }
  assert.deepEqual(mismatched, []);
});

test("interpolate substitutes known placeholders and leaves unknown ones visible", () => {
  assert.equal(interpolate("Offered in {n} terms", { n: 18 }), "Offered in 18 terms");
  assert.equal(interpolate("{a} and {b}", { a: "x", b: "y" }), "x and y");
  // A typo must stay visible rather than blanking the value.
  assert.equal(interpolate("Blocked by {key}", { other: "z" }), "Blocked by {key}");
  assert.equal(interpolate("no placeholders", { n: 1 }), "no placeholders");
  assert.equal(interpolate("{n} left"), "{n} left");
});

test("the English slot is not accidentally holding Turkish text", () => {
  // calendar.tooltipNoDates shipped the Turkish sentence verbatim in its `en`
  // slot, so English users read Turkish on a disabled button. Turkish-specific
  // letters in an English string are a cheap, reliable signal for that class of
  // copy-paste mistake.
  const turkishOnly = /[çğışöüÇĞİŞÖÜ]/;
  const suspicious = Object.entries(dict)
    .filter(([, entry]) => turkishOnly.test(entry.en))
    .map(([key]) => key);
  assert.deepEqual(suspicious, []);
});

test("solver outcome keys stay distinct", () => {
  // Conflating "proven impossible" with "search gave up" is a correctness bug
  // in what the user is told, so the two strings must never collapse into one.
  for (const lang of LANGS) {
    const unsatisfiable = lookup("list.solverUnsatisfiable", lang);
    const gaveUp = lookup("list.solverGaveUp", lang);
    assert.equal(unsatisfiable.missing, false);
    assert.equal(gaveUp.missing, false);
    assert.notEqual(unsatisfiable.text, gaveUp.text);
  }
});

test("the credit-total key keeps the wording e2e/helpers.ts matches on", () => {
  // e2e/helpers.ts totalCredits() locates the figure with
  // /(Total Credits|Toplam Kredi)/i; drifting from it breaks every spec that
  // reads the credit total.
  assert.match(lookup("list.totalCredits", "en").text, /Total Credits/i);
  assert.match(lookup("list.totalCredits", "tr").text, /Toplam Kredi/i);
});

test("the unreachable Google Calendar cap key is gone", () => {
  // calendar.gcalTooMany guarded a branch that could never run: the
  // >6-course gate its comment described was never implemented.
  assert.equal("calendar.gcalTooMany" in dict, false);
});
