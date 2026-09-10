import test from "node:test";
import assert from "node:assert/strict";
import {
  GRADE_POINTS,
  GRADES,
  RETAKEABLE_GRADES,
  gradePoint,
  computeTermStats,
  computeCumulativeStats,
} from "../../../src/lib/gpa.mjs";

const close = (actual, expected, message) =>
  assert.ok(
    Math.abs(actual - expected) < 1e-9,
    `${message ?? "value"}: expected ${expected}, got ${actual}`,
  );

// ---- the grade table itself ----

test("the BOUN table is exactly the published one", () => {
  assert.deepEqual(GRADE_POINTS, {
    AA: 4.0,
    BA: 3.5,
    BB: 3.0,
    CB: 2.5,
    CC: 2.0,
    DC: 1.5,
    DD: 1.0,
    FF: 0.0,
    P: null,
  });
  assert.deepEqual(GRADES, ["AA", "BA", "BB", "CB", "CC", "DC", "DD", "FF", "P"]);
});

test("P carries no points rather than zero points", () => {
  // 0 would average in as a failing grade; null means "outside the average".
  assert.equal(gradePoint("P"), null);
  assert.notEqual(gradePoint("P"), 0);
  assert.equal(gradePoint("FF"), 0);
  assert.equal(gradePoint("nonsense"), undefined);
});

test("only FF, DD and DC are repeatable", () => {
  assert.deepEqual(RETAKEABLE_GRADES, ["FF", "DD", "DC"]);
  for (const grade of RETAKEABLE_GRADES) {
    assert.ok(grade in GRADE_POINTS, `${grade} must be a real grade`);
  }
});

// ---- term GPA ----

test("term GPA is credit-weighted, not a mean of grades", () => {
  const stats = computeTermStats([
    { credits: 4, grade: "AA" }, // 16
    { credits: 1, grade: "CC" }, //  2
  ]);
  close(stats.gpa, 18 / 5, "gpa");
  assert.equal(stats.gpaCredits, 5);
  assert.equal(stats.totalCredits, 5);
});

test("an ungraded term has no GPA, not a GPA of zero", () => {
  // The whole reason this returns null: 0.00 is a real GPA and would be a
  // claim about a term nobody has graded.
  const stats = computeTermStats([{ credits: 3, grade: "" }]);
  assert.equal(stats.gpa, null);
  assert.equal(stats.gpaCredits, 0);
  assert.equal(stats.totalCredits, 0);
  assert.equal(computeTermStats([]).gpa, null);
});

test("a term of nothing but FF averages to a real zero", () => {
  const stats = computeTermStats([{ credits: 3, grade: "FF" }]);
  assert.equal(stats.gpa, 0);
  assert.equal(stats.gpaCredits, 3);
});

test("P earns credits but stays out of the average", () => {
  const stats = computeTermStats([
    { credits: 3, grade: "AA" },
    { credits: 2, grade: "P" },
  ]);
  assert.equal(stats.gpa, 4);
  assert.equal(stats.gpaCredits, 3);
  assert.equal(stats.totalCredits, 5);
});

test("a P-only term has credits but no GPA", () => {
  const stats = computeTermStats([{ credits: 2, grade: "P" }]);
  assert.equal(stats.gpa, null);
  assert.equal(stats.totalCredits, 2);
});

test("rows with no credit figure are skipped whole", () => {
  // LAB and P.S. sub-rows carry no `credits` key in the scraped data; counting
  // them as zero-credit AA would be inventing a course.
  const stats = computeTermStats([
    { credits: undefined, grade: "AA" },
    { credits: 0, grade: "AA" },
    { credits: -3, grade: "AA" },
    { credits: Number.NaN, grade: "AA" },
    { credits: 3, grade: "BB" },
  ]);
  assert.equal(stats.gpa, 3);
  assert.equal(stats.gpaCredits, 3);
});

test("an unrecognised grade string is ignored, not treated as a pass", () => {
  const stats = computeTermStats([
    { credits: 3, grade: "A+" },
    { credits: 3, grade: "AA" },
  ]);
  assert.equal(stats.gpa, 4);
  assert.equal(stats.totalCredits, 3);
});

// ---- cumulative GPA ----

test("cumulative GPA blends the term into the standing record", () => {
  const stats = computeCumulativeStats(
    [{ credits: 10, grade: "AA" }],
    { gpa: 2, credits: 10 },
  );
  close(stats.gpa, 3, "gpa"); // (20 + 40) / 20
  assert.equal(stats.gpaCredits, 20);
});

test("with no record the cumulative GPA is just the term GPA", () => {
  const term = [{ credits: 3, grade: "BA" }];
  const stats = computeCumulativeStats(term, { gpa: 0, credits: 0 });
  assert.equal(stats.gpa, computeTermStats(term).gpa);
});

test("a record with no term graded yet reports the record back", () => {
  const stats = computeCumulativeStats([], { gpa: 3.2, credits: 40 });
  close(stats.gpa, 3.2, "gpa");
  assert.equal(stats.gpaCredits, 40);
});

test("nothing anywhere means no cumulative GPA", () => {
  assert.equal(computeCumulativeStats([], { gpa: 0, credits: 0 }).gpa, null);
});

test("a retake withdraws the old attempt and substitutes the new one", () => {
  // 30 credits at 3.00 = 90 points, 3 of them an FF. Repeating it as AA:
  // baseline becomes 27 credits / 90 points, plus 3 credits x 4.0 = 12.
  const stats = computeCumulativeStats(
    [{ credits: 3, grade: "AA" }],
    { gpa: 3, credits: 30 },
    [{ credits: 3, oldGrade: "FF" }],
  );
  assert.equal(stats.gpaCredits, 30);
  assert.equal(stats.retakeCreditsRemoved, 3);
  assert.equal(stats.previousCreditsKept, 27);
  close(stats.gpa, 102 / 30, "gpa");
});

test("repeating a DD withdraws its points too, not only its credits", () => {
  const stats = computeCumulativeStats(
    [{ credits: 4, grade: "BB" }],
    { gpa: 2.5, credits: 20 },
    [{ credits: 4, oldGrade: "DD" }],
  );
  // 50 points - (1.0 x 4) = 46 over 16 kept credits, plus 3.0 x 4 = 12.
  assert.equal(stats.previousCreditsKept, 16);
  close(stats.gpa, 58 / 20, "gpa");
});

test("a retake of a non-repeatable or unknown grade is refused", () => {
  const baseline = { gpa: 3, credits: 30 };
  const term = [{ credits: 3, grade: "AA" }];
  for (const oldGrade of ["P", "", "A+", undefined]) {
    const stats = computeCumulativeStats(term, baseline, [
      { credits: 3, oldGrade },
    ]);
    assert.equal(
      stats.retakeCreditsRemoved,
      0,
      `oldGrade ${String(oldGrade)} must withdraw nothing`,
    );
  }
});

test("retakes cannot withdraw more than the record holds", () => {
  // Contradictory input: 3 credits of record, 12 credits claimed as retakes.
  const stats = computeCumulativeStats(
    [{ credits: 12, grade: "AA" }],
    { gpa: 4, credits: 3 },
    [
      { credits: 6, oldGrade: "FF" },
      { credits: 6, oldGrade: "DD" },
    ],
  );
  assert.equal(stats.previousCreditsKept, 0);
  assert.equal(stats.retakeCreditsRemoved, 3);
  assert.equal(stats.gpa, 4);
});

test("the aggregate cap keeps a contradictory record from inventing points", () => {
  // Withdrawing more points than the record earned must not leave a negative
  // or an above-4.0 baseline behind. Clamping credits and points separately
  // is what used to produce an impossible GPA here.
  const stats = computeCumulativeStats(
    [{ credits: 3, grade: "CC" }],
    { gpa: 0.5, credits: 6 },
    [{ credits: 6, oldGrade: "DC" }],
  );
  assert.ok(stats.gpa !== null && stats.gpa >= 0 && stats.gpa <= 4, "in range");
  assert.equal(stats.previousCreditsKept, 0);
  assert.equal(stats.gpa, 2);
});

test("the aggregate cap binds while credits remain, not only at zero", () => {
  // The other cap tests drive keptCredits to 0, where Math.min(0*4, ...) and
  // Math.max(0, ...) agree and the cap is not what produces the answer — so
  // deleting the cap left every test green. Here 3 baseline credits survive and
  // the withdrawn points are far too few to match them: uncapped, the baseline
  // would carry 42 points on 3 credits (a 14.0 average) and the result would
  // clamp to 4.00 instead of 2.50.
  const stats = computeCumulativeStats(
    [{ credits: 9, grade: "CC" }],
    { gpa: 3.5, credits: 12 },
    [{ credits: 9, oldGrade: "FF" }],
  );
  assert.equal(stats.previousCreditsKept, 3);
  assert.equal(stats.retakeCreditsRemoved, 9);
  // Asserted on points, not only on the GPA: the final Math.min(4, ...) hides
  // an inflated numerator, which is how the missing cap stayed invisible.
  assert.equal(stats.points, 18 + 12);
  assert.equal(stats.gpaCredits, 12);
  close(stats.gpa, 2.5, "gpa");
});

test("an out-of-range or unparseable record is clamped, never propagated", () => {
  const term = [{ credits: 3, grade: "AA" }];
  for (const previous of [
    { gpa: 9, credits: 3 },
    { gpa: -2, credits: 3 },
    { gpa: Number.NaN, credits: 3 },
    { gpa: 3, credits: -5 },
    { gpa: 3, credits: Number.NaN },
  ]) {
    const stats = computeCumulativeStats(term, previous);
    assert.ok(
      stats.gpa !== null && stats.gpa >= 0 && stats.gpa <= 4,
      `${JSON.stringify(previous)} produced ${stats.gpa}`,
    );
  }
});

test("P in the term adds credits to the total but not to the average", () => {
  const stats = computeCumulativeStats(
    [
      { credits: 3, grade: "P" },
      { credits: 3, grade: "AA" },
    ],
    { gpa: 3, credits: 3 },
  );
  assert.equal(stats.gpaCredits, 6);
  assert.equal(stats.totalCredits, 9);
  close(stats.gpa, 3.5, "gpa");
});
