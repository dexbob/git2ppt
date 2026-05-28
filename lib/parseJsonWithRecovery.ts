function extractFirstJsonObject(raw: string): string | null {
  const start = raw.indexOf('{');
  if (start < 0) return null;
  let inString = false;
  let escaped = false;
  let depth = 0;
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i]!;
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return raw.slice(start, i + 1);
      }
    }
  }
  return null;
}

function normalizeCommonJsonText(raw: string): string {
  return raw
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/,\s*([}\]])/g, '$1');
}

/**
 * JSON 문자열 내부의 비이스케이프 제어문자(\n, \r, \t 등)를 이스케이프한다.
 * LLM이 긴 markdown 본문을 값으로 넣을 때 종종 발생하는
 * "Bad control character in string literal" 오류를 완화한다.
 */
function escapeControlCharsInStrings(raw: string): string {
  let out = '';
  let inString = false;
  let escaped = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]!;
    if (!inString) {
      out += ch;
      if (ch === '"') inString = true;
      continue;
    }

    if (escaped) {
      out += ch;
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      out += ch;
      escaped = true;
      continue;
    }
    if (ch === '"') {
      out += ch;
      inString = false;
      continue;
    }

    if (ch === '\n') {
      out += '\\n';
      continue;
    }
    if (ch === '\r') {
      out += '\\r';
      continue;
    }
    if (ch === '\t') {
      out += '\\t';
      continue;
    }
    if (ch === '\b') {
      out += '\\b';
      continue;
    }
    if (ch === '\f') {
      out += '\\f';
      continue;
    }
    out += ch;
  }
  return out;
}

/**
 * 문자열 내부의 비정상 따옴표를 이스케이프해서 JSON 파서가 깨지는 경우를 완화한다.
 * 종료 따옴표가 올 수 없는 문맥(다음 토큰이 구분자 아님)에서는 내부 따옴표로 간주한다.
 */
function escapeSuspiciousInnerQuotes(raw: string): string {
  let out = '';
  let inString = false;
  let escaped = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]!;
    if (!inString) {
      out += ch;
      if (ch === '"') inString = true;
      continue;
    }

    if (escaped) {
      out += ch;
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      out += ch;
      escaped = true;
      continue;
    }
    if (ch === '"') {
      let j = i + 1;
      while (j < raw.length && /\s/.test(raw[j]!)) j++;
      const next = raw[j] ?? '';
      const looksLikeTerminator =
        next === '' || next === ',' || next === '}' || next === ']' || next === ':';
      if (!looksLikeTerminator) {
        out += '\\"';
      } else {
        out += ch;
        inString = false;
      }
      continue;
    }
    out += ch;
  }
  return out;
}

export function parseJsonWithRecovery<T>(raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    // keep trying below
  }

  const normalized = normalizeCommonJsonText(raw);
  try {
    return JSON.parse(normalized) as T;
  } catch {
    // keep trying below
  }

  const escapedControls = escapeControlCharsInStrings(normalized);
  try {
    return JSON.parse(escapedControls) as T;
  } catch {
    // keep trying below
  }

  const firstObj = extractFirstJsonObject(escapedControls);
  if (firstObj) {
    try {
      return JSON.parse(firstObj) as T;
    } catch {
      const escaped = escapeSuspiciousInnerQuotes(firstObj);
      return JSON.parse(escaped) as T;
    }
  }

  // 최후 시도: 전체 텍스트에 비정상 내부 따옴표 보정
  return JSON.parse(escapeSuspiciousInnerQuotes(escapedControls)) as T;
}

