const ZERO_WIDTH_RE = /[​‌‍⁠﻿]/g;

// Leading list markers: "1.", "1)", "1 -", "1:", "-", "*" ...
const LIST_MARKER_RE = /^(?:\d+\s*[.)\-:]|[-*•])\s*/;

/**
 * Parses a block of pasted text (one team per line) into a clean list of team names.
 * Strips numbering/bullets, zero-width characters (zero-width space/joiners, word joiner,
 * BOM — common when pasting numbered lists copied from WhatsApp/Telegram/Notion), and blank
 * lines.
 */
export function parseBulkTeamNames(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.replace(ZERO_WIDTH_RE, '').trim())
    .filter((line) => line.length > 0)
    .map((line) => line.replace(LIST_MARKER_RE, '').trim())
    .filter((line) => line.length > 0);
}
