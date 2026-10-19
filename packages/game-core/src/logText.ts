// The engine writes some log lines with internal codes (sides, OPS modes, regions, scoring tiers).
// Translate them for display only, so engine strings and replays stay unchanged.
const TERMS: Record<string, string> = {
  USSR: '苏联', US: '美国',
  INFLUENCE: '放置影响力', REALIGNMENT: '调整', COUP: '政变',
  BEFORE: '在 OPS 前结算', AFTER: '在 OPS 后结算',
  EUROPE: '欧洲', ASIA: '亚洲', MIDDLE_EAST: '中东', AFRICA: '非洲',
  CENTRAL_AMERICA: '中美洲', SOUTH_AMERICA: '南美洲', SOUTHEAST_ASIA: '东南亚',
  NONE: '无', PRESENCE: '存在', DOMINATION: '优势', CONTROL: '控制',
};
const PATTERN = new RegExp('\\b(' + Object.keys(TERMS).join('|') + ')\\b', 'g');

export function formatLogLine(line: string): string {
  return line.replace(PATTERN, (term) => TERMS[term]);
}

/** Drops engine-internal lines (the seed must not be shown) and translates the rest. */
export function formatLog(lines: readonly string[]): string[] {
  return lines.filter((line) => !line.startsWith('Game created with seed ')).map(formatLogLine);
}
