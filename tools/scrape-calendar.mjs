#!/usr/bin/env node
/**
 * Scrape the official academic calendar (akademiktakvim.bogazici.edu.tr) into
 * public/data/semester-dates.json.
 *
 * Flow: fetch the calendar home page → find year-PDF links on mediastore →
 * download each PDF → extract text (unpdf) → parse term boundaries + holidays →
 * merge into semester-dates.json.
 *
 * Existing hand-entered entries are only overwritten when the PDF yields a real
 * value for that field, and a summary of changes is printed. Exits non-zero if
 * nothing could be scraped at all (site down / layout change), leaving old data.
 *
 * Usage: node tools/scrape-calendar.mjs [--dry-run]
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { extractText, getDocumentProxy } from "unpdf";

import { parseCalendarText } from "./lib/parse-calendar.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATES_FILE = path.join(ROOT, "public", "data", "semester-dates.json");
const CALENDAR_HOME = "https://akademiktakvim.bogazici.edu.tr/tr/events/akademik";
const TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const MAX_PDFS = 3; // current + previous years are plenty

const DRY_RUN = process.argv.includes("--dry-run");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchText(url) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { "User-Agent": "boun-course-planner-bot/1.0" },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES) await sleep(1_500 * attempt);
    }
  }
  throw new Error(`Failed to fetch ${url}: ${lastError?.message}`);
}

async function fetchPdf(url) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { "User-Agent": "boun-course-planner-bot/1.0" },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.subarray(0, 5).toString() !== "%PDF-") {
        throw new Error("not a PDF (layout change?)");
      }
      return buffer;
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES) await sleep(1_500 * attempt);
    }
  }
  throw new Error(`Failed to download ${url}: ${lastError?.message}`);
}

/** Pull mediastore year-PDF links off the calendar home page. */
export function findCalendarPdfs(html) {
  const links = [...html.matchAll(/https:\/\/mediastore\.cc\.bogazici\.edu\.tr[^"']*\.(?:pdf|PDF)/g)]
    .map((m) => m[0]);
  return [...new Set(links)];
}

/** Derive the academic-year label ("2026/2027") from a PDF's own title line. */
function pdfYearLabel(text) {
  const m = text.match(/(\d{4})-(\d{4})\s+AKADEM[İI]K TAKVİM/i);
  return m ? `${m[1]}/${m[2]}` : null;
}

/**
 * Merge parsed terms into existing semester-dates.json data without losing
 * hand-entered information: PDF values win per-field, but null fields keep
 * whatever was there before.
 */
export function mergeTerms(existing, parsed) {
  const merged = structuredClone(existing);
  const changed = [];
  for (const [semester, entry] of Object.entries(parsed)) {
    if (!merged[semester]) merged[semester] = { start: null, end: null, holidays: [] };
    const target = merged[semester];
    for (const field of ["start", "end"]) {
      if (entry[field] && target[field] !== entry[field]) {
        target[field] = entry[field];
        changed.push(`${semester}.${field} -> ${entry[field]}`);
      }
    }
    // Holidays: replace wholesale when the PDF produced any for this term.
    if (entry.holidays.length > 0) {
      const before = JSON.stringify(target.holidays);
      const after = JSON.stringify(
        [...entry.holidays].sort((a, b) => a.date.localeCompare(b.date)),
      );
      if (before !== after) {
        target.holidays = JSON.parse(after);
        changed.push(`${semester}.holidays (${entry.holidays.length} gün)`);
      }
    }
  }
  return { merged, changed };
}

async function main() {
  console.log("Fetching calendar home page…");
  const html = await fetchText(CALENDAR_HOME);
  const pdfUrls = findCalendarPdfs(html);
  if (pdfUrls.length === 0) {
    throw new Error("no calendar PDF links found — page layout may have changed");
  }
  console.log(`Found ${pdfUrls.length} calendar PDF(s)`);

  const existing = JSON.parse(readFileSync(DATES_FILE, "utf8"));
  let parsedAll = {};

  for (const url of pdfUrls.slice(0, MAX_PDFS)) {
    console.log(`Downloading ${path.basename(url)}…`);
    const bytes = await fetchPdf(url);
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const { text } = await extractText(pdf, { mergePages: true });
    const label = pdfYearLabel(text) ?? "(başlıksız)";
    const terms = parseCalendarText(text);
    const withBoundaries = Object.entries(terms).filter(
      ([, v]) => v.start || v.end,
    ).length;
    console.log(`  ${label}: ${withBoundaries} dönem sınırı parse edildi`);
    parsedAll = { ...parsedAll, ...terms };
  }

  if (Object.keys(parsedAll).length === 0) {
    throw new Error("calendar PDFs yielded no term data");
  }

  const { merged, changed } = mergeTerms(existing, parsedAll);

  if (changed.length === 0) {
    console.log("semester-dates.json already up to date.");
    return;
  }

  console.log("Changes:");
  for (const line of changed) console.log(`  ${line}`);

  if (DRY_RUN) {
    console.log("--dry-run: not written.");
    return;
  }

  writeFileSync(DATES_FILE, JSON.stringify(merged, null, 4) + "\n");
  console.log("semester-dates.json written.");
}

main().catch((error) => {
  console.error(`CALENDAR SCRAPER FAILED: ${error.message}`);
  process.exit(1);
});
