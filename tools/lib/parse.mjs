/**
 * Parsers for registration.boun.edu.tr HTML.
 *
 * Department list:  /scripts/schdepsel.asp
 * Schedule pages:   /scripts/sch.asp?donem=YYYY/YYYY-T&kisaadi=XX&bolum=FULL+NAME
 *
 * A schedule page is a table whose rows are:
 *  - main row (first cell holds e.g. "CMPE150.03"): code, desc, name, credits,
 *    ects, instructor, days, slots, _, _, rooms, examDate, _
 *  - continuation rows (class contains "labps", first cell empty): the LAB /
 *    P.S. meetings of the section above; cells shift left because there is no
 *    code / desc / name / credits / ects: type, _, instructor, days, slots,
 *    _, _, rooms
 *
 * Day tokens are variable length ("M", "T", "W", "Th", "F", "St") and slot
 * numbers can be two digits (10-13), both concatenated without separators
 * ("ThThThTh" + "1234" or "WWW" + "8910"). Meetings are matched by splitting
 * days into tokens, then backtracking over the digit string so every meeting
 * gets a valid slot number (1-13).
 */

import * as cheerio from "cheerio";

const MAX_SLOT = 13;

const DAY_TOKENS = ["Th", "Su", "St", "M", "T", "W", "F"];

export function splitDays(days) {
  const tokens = [];
  let rest = days;
  while (rest.length > 0) {
    const token = DAY_TOKENS.find((t) => rest.startsWith(t));
    if (!token) {
      throw new Error(`Unrecognised day token in "${days}"`);
    }
    tokens.push(token);
    rest = rest.slice(token.length);
  }
  return tokens;
}

/** Match n meetings to a digit string like "8910" -> [8, 9, 10]. */
export function splitSlots(digits, count) {
  const results = [];

  function walk(index, slots) {
    if (slots.length === count) {
      if (index === digits.length) results.push([...slots]);
      return;
    }
    const remainingMeetings = count - slots.length;
    const remainingDigits = digits.length - index;
    // Fast path: all single-digit from here on.
    if (remainingDigits === remainingMeetings) {
      for (let i = index; i < digits.length; i++) {
        const slot = Number(digits[i]);
        if (slot < 1 || slot > MAX_SLOT) return;
        slots.push(slot);
      }
      results.push([...slots]);
      return;
    }
    // Try a two-digit slot first when there are surplus digits.
    if (remainingDigits > remainingMeetings && index + 1 < digits.length) {
      const two = Number(digits.slice(index, index + 2));
      if (two >= 10 && two <= MAX_SLOT) {
        slots.push(two);
        walk(index + 2, slots);
        slots.pop();
      }
    }
    const one = Number(digits[index]);
    if (one >= 1 && one <= MAX_SLOT) {
      slots.push(one);
      walk(index + 1, slots);
      slots.pop();
    }
  }

  walk(0, []);
  if (results.length === 0) {
    throw new Error(`Cannot match ${count} meetings to slots "${digits}"`);
  }
  return results[0];
}

function cellText($, element) {
  return $(element).text().replace(/\u00a0/g, " ").trim();
}

/** Split "NH 405 | NH 201" style room cell into per-meeting rooms. */
function splitRooms(roomsCell, meetingCount) {
  if (!roomsCell) {
    return Array.from({ length: meetingCount }, () => "");
  }
  const rooms = roomsCell.split("|").map((r) => r.trim());
  if (rooms.length !== meetingCount) {
    // Fall back to repeating the last room rather than dropping data.
    while (rooms.length < meetingCount) rooms.push(rooms[rooms.length - 1] ?? "");
    return rooms.slice(0, meetingCount);
  }
  return rooms;
}

/**
 * Locate the schedule table's header row and map column labels to indices.
 * Throws when the layout changes — that is our format-change detector.
 */
const COLUMN_ALIASES = {
  code: ["Code.Sec", "Code_Sec"],
  name: ["Name"],
  credits: ["Cr.", "Cr"],
  ects: ["Ects"],
  instructor: ["Instr."],
  days: ["Days"],
  slots: ["Hours"],
  rooms: ["Rooms"],
};

function findColumnMap($) {
  for (const headerRow of $("tr").toArray()) {
    if (!/schtitle/.test($(headerRow).attr("class") ?? "")) continue;
    const labels = $(headerRow)
      .find("th,td")
      .toArray()
      .map((c) => cellText($, c));
    const map = {};
    for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
      const index = labels.findIndex((l) => aliases.includes(l));
      if (index === -1) {
        throw new Error(
          `Schedule header missing "${field}" column (labels: ${labels.join(" | ")})`,
        );
      }
      map[field] = index;
    }
    return map;
  }
  throw new Error("No schedule table header row (schtitle) found on page");
}

/**
 * Parse one department's schedule page into a map of sections.
 * @returns {{sections: Map<string, object>, warnings: string[]}}
 */
export function parseSchedulePage(html, { kisaadi } = {}) {
  const $ = cheerio.load(html);
  const columns = findColumnMap($);
  const rows = $("tr").filter((_, tr) => {
    const cls = $(tr).attr("class") ?? "";
    return /\bschtd/.test(cls);
  });

  const sections = new Map();
  const warnings = [];
  let current = null;

  for (const row of rows) {
    const cells = $(row).find("td").toArray().map((td) => cellText($, td));
    const isLabRow = /labps/.test($(row).attr("class") ?? "") || !cells[columns.code];

    try {
      if (!isLabRow) {
        const rawCode = cells[columns.code];
        if (!rawCode) continue;
        const entry = {
          code: rawCode,
          credits: Number(cells[columns.credits]) || 0,
          days: [],
          dept: kisaadi ? [kisaadi] : undefined,
          ects: Number(cells[columns.ects]) || 0,
          hours: [],
          instructor: cells[columns.instructor],
          name: cells[columns.name],
          rooms: [],
        };
        appendMeetings(entry, cells[columns.days], cells[columns.slots], cells[columns.rooms]);
        current = { key: rawCode.replace(/\s+/g, ""), entry };
        sections.set(current.key, current);
      } else if (current) {
        appendMeetings(current.entry, cells[columns.days], cells[columns.slots], cells[columns.rooms]);
      }
    } catch (error) {
      warnings.push(`${current?.key ?? "?"}: ${error.message}`);
    }
  }

  return { sections, warnings };
}

function appendMeetings(entry, daysCell, slotsCell, roomsCell) {
  if (!daysCell && !slotsCell) return;
  const days = daysCell ? splitDays(daysCell) : [];
  const hours = slotsCell ? splitSlots(slotsCell, Math.max(days.length, 1)) : [];
  const rooms = splitRooms(roomsCell, Math.max(days.length, hours.length));

  entry.days.push(...days);
  entry.hours.push(...hours);
  entry.rooms.push(...rooms);
}

/**
 * Parse the department list page into {kisaadi, bolum} pairs.
 * @returns {Array<{kisaadi: string, bolum: string}>}
 */
export function parseDepartmentList(html) {
  const $ = cheerio.load(html);
  const departments = new Map();
  for (const anchor of $("a[href*='sch.asp']").toArray()) {
    const href = $(anchor).attr("href") ?? "";
    const kisaadi = new URLSearchParams(
      href.slice(href.indexOf("?") + 1).replace(/&amp;/g, "&"),
    ).get("kisaadi");
    const bolum = new URLSearchParams(
      href.slice(href.indexOf("?") + 1).replace(/&amp;/g, "&"),
    ).get("bolum");
    if (kisaadi && bolum && !departments.has(kisaadi + "|" + bolum)) {
      departments.set(kisaadi + "|" + bolum, { kisaadi, bolum });
    }
  }
  return [...departments.values()];
}
