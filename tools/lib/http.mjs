/**
 * HTTP helper for registration.boun.edu.tr.
 *
 * The site serves classic ASP pages encoded in ISO-8859-9 (Turkish) and is
 * occasionally slow or flaky, so every request goes through retry with
 * exponential backoff and a hard timeout.
 */

const BASE_URL = "https://registration.boun.edu.tr";
const MAX_RETRIES = 4;
const TIMEOUT_MS = 20_000;
const RETRY_DELAY_MS = 1_500;
const RATE_LIMIT_DELAY_MS = 30_000;

const DECODER = new TextDecoder("iso-8859-9");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch a page from the registration site and return it decoded as text.
 * Retries on network errors and non-2xx/3xx statuses.
 * @param {string} path Path starting with "/", e.g. "/scripts/sch.asp"
 * @param {Record<string, string>} params Query parameters (URLSearchParams-encoded)
 * @returns {Promise<string>} decoded HTML
 */
export async function fetchPage(path, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const url = `${BASE_URL}${path}${qs ? `?${qs}` : ""}`;

  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { "User-Agent": "boun-course-planner-bot/1.0" },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      const text = DECODER.decode(buffer);
      // The server answers abuse/rate-limits with a redirect to an "Alert"
      // page. Treat it as retryable rather than valid (empty) content.
      if (/<title>\s*Alert\s*<\/title>/i.test(text)) {
        throw new Error(`rate-limited (Alert page) for ${url}`);
      }
      return text;
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES) {
        const isRateLimit = /rate-limited/.test(lastError.message);
        await sleep(isRateLimit ? RATE_LIMIT_DELAY_MS : RETRY_DELAY_MS * attempt);
      }
    }
  }
  throw new Error(`Failed after ${MAX_RETRIES} attempts: ${url} (${lastError?.message})`);
}

/** Fetch a department schedule page. */
export function fetchSchedule(donem, kisaadi, bolum) {
  return fetchPage("/scripts/sch.asp", { donem, kisaadi, bolum });
}
