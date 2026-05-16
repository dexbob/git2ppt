import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const execFileAsync = promisify(execFile);

const CONVERT_MS = Number(process.env.LIBREOFFICE_TIMEOUT_MS ?? 180_000);

export type PptxToPdfResult = { pdf: Buffer | null; error: string | null };

function stderrFromExecError(err: unknown): string {
  if (!err || typeof err !== 'object') return '';
  const stderr = (err as { stderr?: Buffer | string }).stderr;
  if (Buffer.isBuffer(stderr)) return stderr.toString('utf8').trim();
  if (typeof stderr === 'string') return stderr.trim();
  return '';
}

function describePdfFailure(err: unknown): string {
  if (err && typeof err === 'object') {
    const code = (err as { code?: string }).code;
    if (code === 'ENOENT') {
      return 'PDF로 변환하지 못했습니다. soffice(LibreOffice) 실행 파일을 찾을 수 없습니다. 설치 후 필요하면 SOFFICE_PATH를 설정하세요.';
    }
    if ((err as { killed?: boolean }).killed) {
      return `PDF로 변환하지 못했습니다. 변환 시간이 ${Math.round(CONVERT_MS / 1000)}초를 넘겼습니다. LIBREOFFICE_TIMEOUT_MS를 늘리거나 문서 크기를 확인하세요.`;
    }
  }
  return 'PDF로 변환하지 못했습니다. LibreOffice headless 변환에 실패했습니다. slides.pptx를 저장한 뒤 로컬에서 soffice로 변환할 수 있습니다.';
}

/**
 * Converts PPTX to PDF using LibreOffice headless when available.
 * On failure, `pdf` is null and `error` is a short user-facing message.
 */
export async function convertPptxBufferToPdf(pptxBuffer: Buffer): Promise<PptxToPdfResult> {
  const soffice = process.env.SOFFICE_PATH?.trim() || 'soffice';
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'git2ppt-pdf-'));
  const pptxPath = path.join(tmp, 'slides.pptx');
  await fs.writeFile(pptxPath, pptxBuffer);
  try {
    await execFileAsync(
      soffice,
      [
        '--headless',
        '--invisible',
        '--nologo',
        '--nofirststartwizard',
        '--convert-to',
        'pdf',
        '--outdir',
        tmp,
        pptxPath,
      ],
      { timeout: CONVERT_MS, maxBuffer: 50 * 1024 * 1024 },
    );
    const pdfPath = path.join(tmp, 'slides.pdf');
    const pdf = await fs.readFile(pdfPath);
    return { pdf, error: null };
  } catch (err) {
    const stderr = stderrFromExecError(err);
    // eslint-disable-next-line no-console
    console.warn('[git2ppt] LibreOffice PDF 변환 실패:', err instanceof Error ? err.message : err, stderr || '');
    return { pdf: null, error: describePdfFailure(err) };
  } finally {
    await fs.rm(tmp, { recursive: true, force: true }).catch(() => undefined);
  }
}
