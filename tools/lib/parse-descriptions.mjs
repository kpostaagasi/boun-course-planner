/**
 * Parsers for the Bogaziçi University undergraduate catalogue pages
 * (bogazici.edu.tr/tr/pages/lisans-programlari/<id>).
 *
 * parseCatalogIndex reads the programme list page (department/faculty links);
 * parseCatalogDepartment reads one department page and extracts every course
 * entry: title, credits, ECTS, description paragraphs and prerequisites.
 */

const INDEX_LINK = /lisans-programlari\/(\d+)/;

/**
 * A course-entry header line, e.g.
 *   "CMPE 150 Introduction to Computing (1+0+4) 3 ECTS 5"
 * Group order: [abbr, number, title, theory+lab breakdown, credits, ects].
 * Credits are the number AFTER the (t+l+x) sum, not the sum itself.
 */
const COURSE_HEADER =
  /^([A-ZÇĞİÖŞÜ]{2,5})\s*(\d{3}[A-Z]?)\s+(.+?)\s*\(\d+\+\d+\+\d+\)\s*(\d+)\s+ECTS\s+(\d+)\s*$/;

const PREREQ_LINE = /^Prerequisites?\s*:\s*(.*)$/i;
/** A standalone "(Türkçe Ad)" line right below the header. */
const TURKISH_TITLE_LINE = /^\(.+\)\s*$/;

/**
 * Convert catalogue HTML to plain lines: comments dropped, <br> and block
 * boundaries become newlines, remaining tags stripped, entities decoded,
 * every line trimmed.
 */
function htmlToLines(html) {
  const text = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(?:p|div|li|ul|ol|table|tr|td|th|h[1-6]|blockquote|section|article)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, "&");
  return text
    .split("\n")
    .map((line) => line.replace(/\u00a0/g, " ").trim());
}

/** Collapse internal whitespace of a string. */
function squash(text) {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Parse the catalogue index page into its programme links.
 * Faculty / coordinatory entries are included as well; whether a page
 * actually lists courses is the scraper's concern.
 *
 * @param {string} html decoded index page HTML
 * @returns {Array<{id: string, name: string}>}
 */
export function parseCatalogIndex(html) {
  const results = [];
  const seen = new Set();
  const linkRe = /<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = linkRe.exec(html)) !== null) {
    const idMatch = match[1].match(INDEX_LINK);
    if (!idMatch) continue;
    const id = idMatch[1];
    if (seen.has(id)) continue;
    const name = squash(match[2].replace(/<[^>]+>/g, ""));
    if (!name) continue;
    seen.add(id);
    results.push({ id, name });
  }
  return results;
}

/** Turn trimmed body lines into "\n\n"-joined paragraphs. */
function paragraphsOf(lines) {
  const paragraphs = [];
  let current = [];
  for (const line of lines) {
    if (line === "") {
      if (current.length > 0) paragraphs.push(current.splice(0).join(" "));
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) paragraphs.push(current.join(" "));
  return paragraphs.map(squash).join("\n\n");
}

/**
 * Parse one department catalogue page into course entries keyed by
 * spaceless course code ("CMPE150"), matching the descriptions.json schema:
 * { title, credits, ects, description, prerequisite }.
 *
 * Robustness: returns {} when nothing matches; an entry whose body never
 * materializes keeps description "" instead of being skipped.
 *
 * @param {string} html decoded department page HTML
 * @returns {Record<string, {title: string, credits: string, ects: string, description: string, prerequisite: string | null}>}
 */
export function parseCatalogDepartment(html) {
  const lines = htmlToLines(html);

  // Indices of lines that start a course entry.
  const starts = [];
  lines.forEach((line, i) => {
    if (COURSE_HEADER.test(line)) starts.push(i);
  });

  const entries = {};
  for (let s = 0; s < starts.length; s++) {
    const header = lines[starts[s]].match(COURSE_HEADER);
    const [, abbr, number, title, credits, ects] = header;
    const end = s + 1 < starts.length ? starts[s + 1] : lines.length;

    // Skip the optional "(Türkçe Ad)" line right under the header,
    // ignoring blank separator lines.
    let bodyStart = starts[s] + 1;
    while (bodyStart < end && lines[bodyStart] === "") bodyStart++;
    if (bodyStart < end && TURKISH_TITLE_LINE.test(lines[bodyStart])) {
      bodyStart++;
      while (bodyStart < end && lines[bodyStart] === "") bodyStart++;
    }

    const body = lines.slice(bodyStart, end);
    const firstPrereq = body.findIndex((line) => PREREQ_LINE.test(line));
    const descLines =
      firstPrereq === -1 ? body : body.slice(0, firstPrereq);
    const prereqText =
      firstPrereq === -1
        ? null
        : squash(
            body
              .slice(firstPrereq)
              .map((line) => line.replace(PREREQ_LINE, "$1"))
              .join(" ")
          ) || null;

    entries[`${abbr}${number}`] = {
      title: squash(title),
      credits,
      ects,
      description: paragraphsOf(descLines),
      prerequisite: prereqText,
    };
  }
  return entries;
}
