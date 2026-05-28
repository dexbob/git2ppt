const SNIPPET_RADIUS = 100;

type JsonParseFailureLocation = {
  position: number | null;
  line: number | null;
  column: number | null;
};

function parseJsonSyntaxErrorLocation(message: string): JsonParseFailureLocation {
  const posMatch = message.match(/position\s+(\d+)/i);
  const lineColMatch = message.match(/line\s+(\d+)\s+column\s+(\d+)/i);
  return {
    position: posMatch ? Number(posMatch[1]) : null,
    line: lineColMatch ? Number(lineColMatch[1]) : null,
    column: lineColMatch ? Number(lineColMatch[2]) : null,
  };
}

function visibleChar(ch: string): string {
  if (ch === '\n') return '\\n';
  if (ch === '\r') return '\\r';
  if (ch === '\t') return '\\t';
  return ch;
}

/** JSON.parse SyntaxError 위치 주변만 잘라 표시용 문자열로 만든다. */
function snippetAroundPosition(raw: string, position: number, radius = SNIPPET_RADIUS): string {
  const pos = Math.min(Math.max(0, position), Math.max(0, raw.length - 1));
  const start = Math.max(0, pos - radius);
  const end = Math.min(raw.length, pos + radius + 1);
  const before = raw.slice(start, pos);
  const at = raw[pos] ?? '';
  const after = raw.slice(pos + 1, end);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < raw.length ? '…' : '';
  return `${prefix}${before}<<<${visibleChar(at)}>>>${after}${suffix}`;
}

/**
 * LLM JSON 파싱 실패 시 전체 응답 대신 오류 지점 주변만 터미널에 출력한다.
 */
export function logJsonParseFailure(scope: string, raw: string, parseErr: unknown): void {
  const message = parseErr instanceof Error ? parseErr.message : String(parseErr);
  console.error(`[${scope}] JSON.parse failed:`, message);

  const loc = parseJsonSyntaxErrorLocation(message);
  if (loc.position == null) {
    console.error(`[${scope}] could not locate parse error in response (length ${raw.length})`);
    return;
  }

  console.error(`[${scope}] parse error near:`, snippetAroundPosition(raw, loc.position));
  console.error(`[${scope}] location:`, {
    position: loc.position,
    line: loc.line,
    column: loc.column,
    rawLength: raw.length,
  });
}
