/**
 * Sanitizes text corrupted during copy-paste from PDFs, Word docs, or other
 * sources with encoding mismatches.
 *
 * Handles:
 *  - Windows-1252 mojibake (UTF-8 bytes misread as cp1252)
 *  - HTML entities (&rarr;, &#8594;, etc.)
 *  - "??' " pattern: each byte of UTF-8 → (→ = →) displayed as a broken char
 */

// Mojibake pairs: [corrupted string, correct char]
// Uses string literals so .split().join() works reliably
const MOJIBAKE: readonly [string, string][] = [
  // → (right arrow) - UTF-8 E2 86 92 read as cp1252: â + † + ’
  ['â†’', '→'],
  // ← (left arrow) - UTF-8 E2 86 90 read as cp1252: â + † + ‘
  ['â†‘', '←'],
  // — (em dash) - UTF-8 E2 80 94 read as cp1252: â + € + ”
  ['â€”', '—'],
  // – (en dash) - UTF-8 E2 80 93 read as cp1252: â + € + “
  ['â€“', '–'],
  // ’ (right single quote) - UTF-8 E2 80 99 read as cp1252: â + € + ™
  ['â€™', '’'],
  // ‘ (left single quote) - UTF-8 E2 80 98 read as cp1252: â + € + ˜
  ['â€˜', '‘'],
  // ” (right double quote) - UTF-8 E2 80 9D
  ['â€', '”'],
  // “ (left double quote) - UTF-8 E2 80 9C
  ['â€œ', '“'],
  // • (bullet) - UTF-8 E2 80 A2
  ['â€¢', '•'],
  // … (ellipsis) - UTF-8 E2 80 A6
  ['â€¦', '…'],
  // ° (degree) - UTF-8 C2 B0 read as cp1252: Â + °
  ['Â°', '°'],
  // · (middle dot) - UTF-8 C2 B7
  ['Â·', '·'],
];

const HTML_ENTITIES: Readonly<Record<string, string>> = {
  // Arrows
  '&rarr;': '→', '&larr;': '←', '&darr;': '↓', '&uarr;': '↑',
  '&rArr;': '⇒', '&lArr;': '⇐', '&hArr;': '⇔',
  '&#8594;': '→', '&#8592;': '←', '&#8595;': '↓', '&#8593;': '↑',
  // Dashes & quotes
  '&mdash;': '—', '&ndash;': '–',
  '&lsquo;': '‘', '&rsquo;': '’',
  '&ldquo;': '“', '&rdquo;': '”',
  '&#8212;': '—', '&#8211;': '–',
  '&#8216;': '‘', '&#8217;': '’',
  '&#8220;': '“', '&#8221;': '”',
  // Punctuation
  '&bull;': '•', '&hellip;': '…',
  '&deg;': '°', '&middot;': '·',
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&nbsp;': ' ',
  // Portuguese uppercase
  '&Agrave;': 'À', '&Aacute;': 'Á', '&Acirc;': 'Â', '&Atilde;': 'Ã',
  '&Egrave;': 'È', '&Eacute;': 'É', '&Ecirc;': 'Ê',
  '&Igrave;': 'Ì', '&Iacute;': 'Í', '&Icirc;': 'Î',
  '&Ograve;': 'Ò', '&Oacute;': 'Ó', '&Ocirc;': 'Ô', '&Otilde;': 'Õ',
  '&Ugrave;': 'Ù', '&Uacute;': 'Ú', '&Ucirc;': 'Û', '&Ccedil;': 'Ç',
  // Portuguese lowercase
  '&agrave;': 'à', '&aacute;': 'á', '&acirc;': 'â', '&atilde;': 'ã',
  '&egrave;': 'è', '&eacute;': 'é', '&ecirc;': 'ê',
  '&igrave;': 'ì', '&iacute;': 'í', '&icirc;': 'î',
  '&ograve;': 'ò', '&oacute;': 'ó', '&ocirc;': 'ô', '&otilde;': 'õ',
  '&ugrave;': 'ù', '&uacute;': 'ú', '&ucirc;': 'û', '&ccedil;': 'ç',
};

export function sanitizeText(text: string): string {
  if (!text || typeof text !== 'string') return text;

  let s = text;

  // 1. Numeric hex HTML entities: &#xNNNN;
  s = s.replace(/&#x([0-9a-fA-F]+);/gi, (_, hex) =>
    String.fromCodePoint(parseInt(hex, 16))
  );

  // 2. Numeric decimal HTML entities: &#NNNN;
  s = s.replace(/&#([0-9]+);/g, (_, dec) =>
    String.fromCodePoint(parseInt(dec, 10))
  );

  // 3. Named HTML entities
  s = s.replace(/&[a-zA-Z]+;/g, (entity) => HTML_ENTITIES[entity] ?? entity);

  // 4. Windows-1252 mojibake sequences
  for (const [from, to] of MOJIBAKE) {
    if (s.includes(from)) s = s.split(from).join(to);
  }

  // 5. "??' " pattern: → (UTF-8 E2 86 92) where each byte was read individually:
  //    E2 → invalid → ? or �
  //    86 → control  → ? or �
  //    92 → cp1252   → ’ (right single quote) or ' (apostrophe)
  // Regex uses \uNNNN to avoid TS1127 "Invalid character" errors with literal Unicode in regex.
  // ? = '?', � = replacement char, ‘ = ', ’ = ', ' = '
  s = s.replace(/[?�]{1,2}[‘’']/g, '→');

  return s;
}

/** Recursively sanitize all string fields in an object or array */
export function sanitizeDeep<T>(value: T): T {
  if (typeof value === 'string') return sanitizeText(value) as unknown as T;
  if (Array.isArray(value)) return value.map(sanitizeDeep) as unknown as T;
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = sanitizeDeep(v);
    }
    return out as T;
  }
  return value;
}
