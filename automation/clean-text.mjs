// MarathiAura — Reusable text-cleaning layer (P1-C)
// Strips raw source HTML/CSS/JS/ad markup from scraped content before it enters drafts.
// Safe: never invents replacement content; returns empty string when nothing genuine remains.

// HTML entities commonly leaked from scraped sources
const ENTITIES = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'",
  '&nbsp;': ' ', '&ndash;': '–', '&mdash;': '—', '&lsquo;': "'", '&rsquo;': "'",
  '&ldquo;': '"', '&rdquo;': '"', '&hellip;': '…', '&#8211;': '–', '&#8212;': '—',
  '&#8216;': "'", '&#8217;': "'", '&#8220;': '"', '&#8221;': '"', '&#8230;': '…'
};

/** Remove raw HTML tags (script, style, and all other tags). */
export function stripHtmlTags(html) {
  if (typeof html !== 'string') return '';
  let t = html
    // Remove <script>...</script> blocks
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    // Remove <style>...</style> blocks
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    // Remove all remaining HTML tags
    .replace(/<[^>]+>/g, ' ')
    // Decode common HTML entities
    .replace(/&[a-z#][a-z0-9]*;/gi, m => ENTITIES[m] !== undefined ? ENTITIES[m] : ' ')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();
  return t;
}

/** Remove ad/analytics JS fragments commonly leaked from scraped pages. */
export function stripAdJs(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/\(adsbygoogle\s*=\s*window\.adsbygoogle\s*\|\|\s*\[\]\)\.push\(\s*\{\s*\}\)\;?/g, '')
    .replace(/googletag\s*\.[a-zA-Z]+\([^;]*\);?/g, '')
    .replace(/fbq\s*\([^;]*\);?/g, '')
    .trim();
}

/** Remove CSS @media rules and style-block fragments. */
export function stripCss(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/@media\s*\([^)]*\)\s*\{[^}]*\}/g, ' ')
    .replace(/\.\w+\s*\{[^}]*\}/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Collapse accidental duplicated sentences/phrases ("Home X X" → "X"). */
export function collapseDuplicates(text) {
  if (typeof text !== 'string') return '';
  // Duplicate phrase: "Word Word " → "Word "
  return text.replace(/([^\s.,!?;:]+)\s+\1(\s|$)/gi, '$1$2').trim();
}

/**
 * Main entry: raw source text → cleaned plain text.
 * Returns empty string if nothing genuine remains after cleaning.
 */
export function cleanSourceText(raw) {
  if (raw == null) return '';
  let t = String(raw);
  t = stripHtmlTags(t);
  t = stripAdJs(t);
  t = stripCss(t);
  t = collapseDuplicates(t);
  return t;
}

/**
 * Check whether cleaned content is genuine (non-thin).
 * Returns { genuine: boolean, text: string, reason: string }.
 */
export function isGenuineContent(raw, minChars = 40) {
  const cleaned = cleanSourceText(raw);
  if (cleaned.length < minChars) {
    return { genuine: false, text: cleaned, reason: `thin-after-cleaning (${cleaned.length} chars)` };
  }
  return { genuine: true, text: cleaned, reason: null };
}
