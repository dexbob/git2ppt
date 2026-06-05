export type PdfOutcome = 'available' | 'conversion_failed' | 'unavailable';

const PDF_UNAVAILABLE_FALLBACK =
  'PDF가 포함되지 않았습니다. Vercel 기본 배포에서는 LibreOffice가 없어 PDF를 만들지 않고 PPTX만 주는 경우가 많습니다. 로컬(`npm run dev` 또는 `./start_server.sh`)로 실행하거나, Cloudmersive API Key를 발급받아 환경 변수에 설정하세요.';

export function resolvePdfOutcome(
  pdfAvailable: boolean,
  pdfError: string | null | undefined,
): PdfOutcome {
  if (pdfAvailable) return 'available';
  if (pdfError?.trim()) return 'conversion_failed';
  return 'unavailable';
}

/** Full copy for download section and detailed UI. */
export function resolvePdfDetailMessage(
  pdfAvailable: boolean,
  pdfError: string | null | undefined,
  pdfNote: string | null | undefined,
): string | null {
  if (pdfAvailable) return null;
  if (pdfError?.trim()) return pdfError.trim();
  return pdfNote?.trim() || PDF_UNAVAILABLE_FALLBACK;
}

function firstSentence(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^[^.!?。]+[.!?。]?/u);
  if (match?.[0]) return match[0].trim();
  if (trimmed.length <= 140) return trimmed;
  return `${trimmed.slice(0, 137)}…`;
}

/** Short copy directly under the progress cards. */
export function resolvePdfSummaryMessage(
  pdfAvailable: boolean,
  pdfError: string | null | undefined,
  pdfNote: string | null | undefined,
): string | null {
  if (pdfAvailable) return null;
  if (pdfError?.trim()) return pdfError.trim();
  if (pdfNote?.trim()) return firstSentence(pdfNote);
  return firstSentence(PDF_UNAVAILABLE_FALLBACK);
}
