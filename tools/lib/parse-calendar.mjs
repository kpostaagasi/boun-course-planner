/**
 * Parser for the official academic-calendar PDFs served from mediastore.cc.bogazici.edu.tr.
 *
 * The PDF lists month-by-month events: a date line ("21 Eylül 2026 Pazartesi" or
 * "8-12 Mart 2027 Pazartesi-Cuma") followed by one or more event lines. We extract:
 *
 *   - term boundaries : "Derslerin başlaması …" → start, "Derslerin son günü" → end
 *   - holidays        : lines containing "(Tatil)", "sonra tatil" (half days), "Arife"
 *
 * Events map onto semester keys ("2026-2027-1") matching public/data/semester-dates.json.
 * The BOUN academic year runs Sep–Aug: fall = Sep–Jan, spring = Jan–Jun, summer = Jul–Aug.
 * (Verified against 2026/2027: fall classes 21 Eyl–11 Ara, spring classes 18 Oca–22 Nis.)
 */

const MONTHS = {
  Ocak: 1, Şubat: 2, Mart: 3, Nisan: 4, Mayıs: 5, Haziran: 6,
  Temmuz: 7, Ağustos: 8, Eylül: 9, Ekim: 10, Kasım: 11, Aralık: 12,
};

/** "21 Eylül 2026 Pazartesi" / "8-12 Mart 2027 Pazartesi-Cuma" → {y, m, d1, d2} */
export function parseDateLine(line) {
  const m = line.match(/(\d{1,2})(?:-(\d{1,2}))?\s+([A-Za-zÇĞİÖŞÜçğıöşü]+)\s+(\d{4})/);
  if (!m) return null;
  const month = MONTHS[m[3]];
  if (!month) return null;
  return { y: +m[4], m: month, d1: +m[1], d2: m[2] ? +m[2] : +m[1] };
}

function iso(y, m, d) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Normalize curly apostrophes and collapsed whitespace left by PDF extraction. */
function clean(text) {
  return text.replace(/[\u2019\u2018]/g, "'").replace(/\s+/g, " ").trim();
}

/**
 * Map a parsed date to its BOUN semester key. September–December belongs to the
 * fall term of year y–y+1; January–June to the spring term of y-1–y; July–August
 * to the summer term.
 */
export function toSemesterKey({ y, m }) {
  const yearPair = m >= 9 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
  const term = m >= 9 ? 1 : m <= 6 ? 2 : 3;
  return `${yearPair}-${term}`;
}

/** Site-wide first day of classes (excludes YADYOK prep and summer-only variants). */
function isTermStart(line) {
  return /^([a-z]\) )?Derslerin başlaması/.test(line);
}

/** Site-wide last day of classes. */
function isTermEnd(line) {
  const bare = line.replace(/^[a-z]\) /, "");
  if (bare !== "Derslerin son günü") return false;
  return true;
}

/** Holiday lines: full days "(Tatil)", afternoons "sonra tatil", eve "Arife …". */
const HOLIDAY_RE = /\(Tatil\)|sonra tatil|^Arife\b/i;

/**
 * Build a holiday entry from an event line. Bare half-day lines ("Saat 13:00'ten
 * sonra tatil") carry no name — the PDF names the eve of the following holiday,
 * so we inherit it (e.g. "Cumhuriyet Bayramı (Yarım Gün)") when available.
 */
function holidayFrom(line, y, m, d, nextHolidayName) {
  const bare = line.replace(/^[a-z]\) /, "").replace(/\s*\(Saat[^)]*\)/, "").trim();
  const halfDay = /sonra tatil/i.test(line);
  if (!halfDay) return { date: iso(y, m, d), name: bare.replace(/\s*\(Tatil\)$/, "") };
  let name;
  if (/Arife/i.test(bare)) {
    name = `${bare.replace(/\s*\(Saat.*$/, "").trim()} (Yarım Gün)`;
  } else {
    const base = bare === "" || /^Saat 13:00['’]?[dt](en|dan)? sonra tatil$/i.test(bare)
      ? nextHolidayName?.replace(/\s*\(Tatil\)$/, "")
      : bare.replace(/\s*\(Tatil\)$/, "");
    name = base ? `${base} (Yarım Gün)` : "Yarım Gün";
  }
  return { date: iso(y, m, d), name, timeType: "after", time: "13:00" };
}


/**
 * Parse extracted PDF text into per-semester records.
 * @param {string} text merged text of the calendar PDF
 * @returns {Record<string, {start: string|null, end: string|null, holidays: Array<{date:string,name:string,timeType?:string,time?:string}>}>}
 */
export function parseCalendarText(text) {
  const terms = new Map();
  const ensure = (key) => {
    if (!terms.has(key)) terms.set(key, { start: null, end: null, holidays: [] });
    return terms.get(key);
  };

  const lines = text.split("\n").map(clean).filter(Boolean);
  let currentDate = null;

  // Name of the next full "(Tatil)" line after each index — bare half-day eves
  // ("Saat 13:00'ten sonra tatil") inherit the following holiday's name.
  const nextHolidayName = new Array(lines.length);
  let pending = null;
  for (let i = lines.length - 1; i >= 0; i--) {
    nextHolidayName[i] = pending;
    if (/\(Tatil\)$/.test(lines[i]) && !/sonra tatil/i.test(lines[i])) {
      pending = lines[i].replace(/^[a-z]\) /, "").trim();
    }
  }

  for (const [i, line] of lines.entries()) {
    if (/^\d/.test(line)) {
      const parsed = parseDateLine(line);
      if (parsed) currentDate = parsed;
      continue;
    }
    if (!currentDate) continue;
    const { y, m, d1, d2 } = currentDate;

    if (isTermStart(line)) {
      const entry = ensure(toSemesterKey(currentDate));
      const d = iso(y, m, d1);
      if (!entry.start || d < entry.start) entry.start = d;
    } else if (isTermEnd(line)) {
      const entry = ensure(toSemesterKey(currentDate));
      const d = iso(y, m, d2);
      if (!entry.end || d > entry.end) entry.end = d;
    }

    if (HOLIDAY_RE.test(line)) {
      for (let d = d1; d <= d2; d++) {
        const entry = ensure(toSemesterKey({ y, m, d }));
        const h = holidayFrom(line, y, m, d, nextHolidayName[i]);
        if (!entry.holidays.some((x) => x.date === h.date && x.name === h.name)) {
          entry.holidays.push(h);
        }
      }
    }
  }

  return Object.fromEntries(terms);
}
