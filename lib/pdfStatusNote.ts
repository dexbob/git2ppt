/**
 * User-facing copy when PDF is not produced on purpose (not a conversion failure).
 */
export function buildPdfSkippedNote(): string {
  if (process.env.SKIP_PDF === '1') {
    return 'PDF는 환경 변수 SKIP_PDF=1 때문에 생성하지 않습니다. PPTX만 제공됩니다. PDF가 필요하면 SKIP_PDF를 제거한 뒤 LibreOffice가 있는 환경에서 다시 실행하세요.';
  }
  if (process.env.VERCEL === '1') {
    return 'Vercel 서버리스에는 LibreOffice가 없어 기본적으로 PDF를 만들지 않습니다. PPTX(slides.pptx)를 내려받은 뒤 로컬에서 변환하거나, 이 프로젝트를 로컬(`npm run dev`)·Docker로 띄우면 PDF까지 받을 수 있습니다. 실험적으로는 환경 변수 ENABLE_PDF_ON_VERCEL=1을 설정할 수 있으나, 용량·실행 시간 제한으로 실패하기 쉽습니다.';
  }
  return '';
}
