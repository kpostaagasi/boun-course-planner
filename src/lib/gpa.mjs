/**
 * Boğaziçi's grade system and the GPA arithmetic that runs on it.
 *
 * Ported from the standalone BOUN GPA Calculator (`src/gpa.js`, `src/grades.js`
 * there), stripped to the two numbers a planner actually needs — this term's
 * GPA and what it does to the cumulative one — and moved into this repo's
 * conventions: pure `.mjs` with a `.ts` type sidecar, so `node --test` can pin
 * the arithmetic without a build step, exactly as eligibility/solver/termKeys do.
 *
 * Two deliberate departures from the original:
 *
 *   - **No DOM, no grade `<select>` rendering.** The original module also built
 *     option lists; that belongs to `GpaCalculator.svelte` here.
 *   - **An unaveragable set returns `gpa: null`, not `0`.** The original
 *     returned 0 and let each call site guard. A zero here would render as
 *     "0.00", which is a real GPA and a lie about a term where nothing has been
 *     graded yet — the product's "unknown is a first-class value" rule. `null`
 *     forces the caller to say "—".
 *
 * Only the BOUN system lives here. Mapping other universities' grades is out
 * of scope for both projects.
 */

/**
 * Grade -> quality points. `P` (pass) carries credit but no points, so it is
 * `null` rather than `0`: averaging it in as a zero would be a failing grade.
 */
export const GRADE_POINTS = /** @type {Record<string, number | null>} */ ({
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

/** Every selectable grade, best first — the order the UI lists them in. */
export const GRADES = ["AA", "BA", "BB", "CB", "CC", "DC", "DD", "FF", "P"];

/**
 * The grades BOUN lets a student repeat. A course taken again replaces only
 * these; anything higher is final, so offering CC as a retake would invite a
 * cumulative GPA the registrar will never agree with.
 */
export const RETAKEABLE_GRADES = ["FF", "DD", "DC"];

/**
 * Points for a grade: a number, `null` for a non-GPA pass, `undefined` if unknown.
 * @param {string} grade
 * @returns {number | null | undefined}
 */
export function gradePoint(grade) {
  return GRADE_POINTS[grade];
}

/**
 * @typedef {object} GpaCourse
 * @property {number | undefined} credits course credits; anything not a
 *   positive finite number contributes nothing (LAB/P.S. rows carry none)
 * @property {string} grade a key of `GRADE_POINTS`; anything else is ignored
 */

/**
 * @typedef {object} TermStats
 * @property {number} points quality points earned
 * @property {number} gpaCredits credits that carry points (excludes `P`)
 * @property {number} totalCredits credits earned, `P` included
 * @property {number | null} gpa `null` when no graded credits exist
 */

/**
 * This term's GPA from its graded courses.
 *
 * A course with no grade chosen is not "not yet passed" — it is simply not part
 * of the calculation, so it is skipped whole rather than counted as zero.
 *
 * @param {GpaCourse[]} courses
 * @returns {TermStats}
 */
export function computeTermStats(courses) {
  let points = 0;
  let gpaCredits = 0;
  let totalCredits = 0;
  for (const course of courses) {
    const credits = Number(course?.credits);
    if (!Number.isFinite(credits) || credits <= 0) continue;
    if (!course.grade || !(course.grade in GRADE_POINTS)) continue;
    totalCredits += credits;
    const point = GRADE_POINTS[course.grade];
    if (typeof point === "number") {
      points += point * credits;
      gpaCredits += credits;
    }
  }
  return {
    points,
    gpaCredits,
    totalCredits,
    gpa: gpaCredits > 0 ? points / gpaCredits : null,
  };
}

/**
 * @typedef {object} Baseline
 * @property {number} gpa cumulative GPA before this term
 * @property {number} credits GPA credits behind that average
 */

/**
 * @typedef {object} Retake
 * @property {number | undefined} credits credits of the course being repeated
 * @property {string} oldGrade the grade being replaced
 */

/**
 * @typedef {object} CumulativeStats
 * @property {number | null} gpa cumulative GPA, `null` when nothing to average
 * @property {number} gpaCredits credits behind that average
 * @property {number} points quality points behind it
 * @property {number} totalCredits credits earned, `P` included
 * @property {number} previousCreditsKept baseline credits left after retakes
 * @property {number} retakeCreditsRemoved baseline credits a retake withdrew
 */

/**
 * Cumulative GPA after this term, with BOUN's repeat rule applied.
 *
 * A repeated course counts once: the new attempt joins the term average as
 * usual, and the old attempt's credits and points are withdrawn from the
 * baseline before the two are combined.
 *
 * The baseline is a GPA and a credit count the student typed in, so it can
 * disagree with the retakes they also typed in. Rather than trust the pair, the
 * withdrawal is capped against what the baseline can actually give up — and
 * capped on the *aggregate*, not per retake, because clamping credits and
 * points independently is what produced impossible GPAs in the original.
 *
 * @param {GpaCourse[]} termCourses
 * @param {Baseline} previous
 * @param {Retake[]} [retakes]
 * @returns {CumulativeStats}
 */
export function computeCumulativeStats(termCourses, previous, retakes = []) {
  const term = computeTermStats(termCourses);

  const rawCredits = Number(previous?.credits);
  const previousCredits = Number.isFinite(rawCredits) ? Math.max(0, rawCredits) : 0;
  const rawGpa = Number(previous?.gpa);
  const previousGpa = Number.isFinite(rawGpa) ? Math.min(4, Math.max(0, rawGpa)) : 0;

  let removedCredits = 0;
  let removedPoints = 0;
  let withdrawable = previousCredits;
  for (const retake of retakes) {
    const credits = Number(retake?.credits);
    const point = GRADE_POINTS[retake?.oldGrade];
    if (!Number.isFinite(credits) || credits <= 0 || typeof point !== "number") {
      continue;
    }
    const applied = Math.min(credits, withdrawable);
    removedCredits += applied;
    removedPoints += point * applied;
    withdrawable -= applied;
  }

  const keptCredits = previousCredits - removedCredits;
  // Keep the adjusted baseline internally consistent even when the supplied
  // GPA and retake records contradict each other: never negative, never above
  // a straight-4.0 record.
  const keptPoints = Math.min(
    keptCredits * 4,
    Math.max(0, previousGpa * previousCredits - removedPoints),
  );

  const gpaCredits = term.gpaCredits + keptCredits;
  const points = term.points + keptPoints;
  // The final clamp is belt to the cap's braces, and is unreachable while the
  // cap above holds: `keptPoints <= keptCredits * 4` and no grade is worth more
  // than 4, so `points <= gpaCredits * 4` already. The cap is the load-bearing
  // half — see the regression test that pins it with credits still remaining.
  return {
    gpa: gpaCredits > 0 ? Math.min(4, Math.max(0, points / gpaCredits)) : null,
    gpaCredits,
    points,
    totalCredits: term.totalCredits + keptCredits,
    previousCreditsKept: keptCredits,
    retakeCreditsRemoved: removedCredits,
  };
}
