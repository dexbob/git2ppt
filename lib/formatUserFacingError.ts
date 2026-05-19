const RETRY_HINT = '잠시 후 「분석 및 자료 생성」을 다시 실행해 주세요.';

/**
 * LLM·API 오류를 UI에 보여줄 짧은 한국어 메시지로 바꿉니다.
 */
export function formatUserFacingError(err: unknown, fallback: string): string {
  const raw =
    err instanceof Error ? err.message : typeof err === 'string' ? err : fallback;

  if (/503|service unavailable|high demand|try again later/i.test(raw)) {
    return `AI 서비스 사용량이 일시적으로 많습니다. 1~2분 뒤에 ${RETRY_HINT}`;
  }
  if (/429|rate limit|resource exhausted|quota/i.test(raw)) {
    return `AI API 호출 한도에 도달했습니다. 잠시 후 다시 시도하거나 API 키·요금제를 확인해 주세요.`;
  }
  if (/502|504|gateway|timed out|timeout|ETIMEDOUT|ECONNRESET/i.test(raw)) {
    return `AI 서비스 응답이 지연되었습니다. ${RETRY_HINT}`;
  }
  if (/JSON 파싱|invalid json|unexpected token/i.test(raw)) {
    return `AI 응답 형식 오류로 결과를 만들지 못했습니다. ${RETRY_HINT} (반복되면 GEMINI_MODEL 변경을 고려해 보세요.)`;
  }
  if (/GoogleGenerativeAI Error/i.test(raw)) {
    if (/503|high demand/i.test(raw)) {
      return `Gemini 서비스가 일시적으로 바쁩니다. 1~2분 뒤에 ${RETRY_HINT}`;
    }
    return `Gemini API 오류가 발생했습니다. ${RETRY_HINT}`;
  }
  if (/OpenAI|openai/i.test(raw) && /error|failed/i.test(raw)) {
    return `OpenAI API 오류가 발생했습니다. ${RETRY_HINT}`;
  }

  return raw.trim() || fallback;
}

export const JSON_RESPONSE_ERROR =
  `AI 응답 형식 오류로 결과를 만들지 못했습니다. ${RETRY_HINT}`;
