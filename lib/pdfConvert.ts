import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const execFileAsync = promisify(execFile);

const CONVERT_MS = Number(process.env.LIBREOFFICE_TIMEOUT_MS ?? 180_000);

export type PptxToPdfResult = { 
  pdf: Buffer | null; 
  error: string | null; 
  pdfRetriable?: boolean; 
};

function stderrFromExecError(err: unknown): string {
  if (!err || typeof err !== 'object') return '';
  const stderr = (err as { stderr?: Buffer | string }).stderr;
  if (Buffer.isBuffer(stderr)) return stderr.toString('utf8').trim();
  if (typeof stderr === 'string') return stderr.trim();
  return '';
}

function describePdfFailure(err: unknown): { error: string; retriable: boolean } {
  const hasCloudmersiveKey = Boolean(process.env.CLOUDMERSIVE_API_KEY?.trim());
  
  if (err && typeof err === 'object') {
    const code = (err as { code?: string }).code;
    if (code === 'ENOENT') {
      if (hasCloudmersiveKey) {
        return {
          error: 'PDF 변환에 실패했습니다. LibreOffice가 서버에 존재하지 않고, Cloudmersive API 변환 중 오류(일일 한도 초과 등)가 발생했습니다.',
          // API Key가 있으므로 API 한도 초과 등 일시적 문제일 가능성이 높아 재시도 가능
          retriable: true
        };
      }
      if (process.env.VERCEL === '1') {
        return {
          error: 'Vercel 서버리스에는 LibreOffice가 기본 탑재되어 있지 않아 PDF 변환에 실패했습니다. Cloudmersive API Key를 발급받아 CLOUDMERSIVE_API_KEY 환경변수에 설정하시면 Vercel에서도 클라우드 변환을 통해 PDF를 생성할 수 있습니다.',
          retriable: false // 키도 없고 빌드 도구도 없으므로 재시도 불가능
        };
      }
      return {
        error: 'PDF로 변환하지 못했습니다. soffice(LibreOffice) 실행 파일을 찾을 수 없습니다. 설치 후 필요하면 SOFFICE_PATH를 설정하세요.',
        retriable: false // 설치가 필수적이므로 즉각적인 재시도는 불가능
      };
    }
    if ((err as { killed?: boolean }).killed) {
      return {
        error: `PDF로 변환하지 못했습니다. 변환 시간이 ${Math.round(CONVERT_MS / 1000)}초를 넘겼습니다. LIBREOFFICE_TIMEOUT_MS를 늘리거나 문서 크기를 확인하세요.`,
        retriable: true
      };
    }
  }
  return {
    error: 'PDF로 변환하지 못했습니다. LibreOffice headless 변환에 실패했습니다. slides.pptx를 저장한 뒤 로컬에서 soffice로 변환할 수 있습니다.',
    retriable: true
  };
}

/**
 * Converts PPTX Buffer to PDF Buffer using Cloudmersive Document Conversion API.
 */
async function convertViaCloudmersive(pptxBuffer: Buffer): Promise<Buffer> {
  const apiKey = process.env.CLOUDMERSIVE_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('CLOUDMERSIVE_API_KEY가 설정되어 있지 않습니다.');
  }

  const formData = new FormData();
  // Native Blob in Node.js 18+
  const blob = new Blob([new Uint8Array(pptxBuffer)], {
    type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  });
  formData.append('inputFile', blob, 'slides.pptx');

  const response = await fetch('https://api.cloudmersive.com/convert/pptx/to/pdf', {
    method: 'POST',
    headers: {
      Apikey: apiKey,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Cloudmersive API 변환 실패 (HTTP ${response.status}): ${errorText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Converts PPTX to PDF using LibreOffice headless when available.
 * Fallback to Cloudmersive API if LibreOffice is missing and CLOUDMERSIVE_API_KEY is configured.
 * On failure, `pdf` is null and `error` is a short user-facing message.
 */
export async function convertPptxBufferToPdf(pptxBuffer: Buffer): Promise<PptxToPdfResult> {
  const soffice = process.env.SOFFICE_PATH?.trim() || 'soffice';
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'git2ppt-pdf-')).catch(() => null);

  if (tmp) {
    const pptxPath = path.join(tmp, 'slides.pptx');
    try {
      await fs.writeFile(pptxPath, pptxBuffer);
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
      const isNoent = err && typeof err === 'object' && (err as { code?: string }).code === 'ENOENT';
      if (!isNoent) {
        const stderr = stderrFromExecError(err);
        // eslint-disable-next-line no-console
        console.warn('[git2ppt] LibreOffice PDF 변환 실패:', err instanceof Error ? err.message : err, stderr || '');
      }

      // Fallback to Cloudmersive
      const cloudmersiveKey = process.env.CLOUDMERSIVE_API_KEY?.trim();
      if (cloudmersiveKey) {
        try {
          // eslint-disable-next-line no-console
          console.info('[git2ppt] LibreOffice를 사용할 수 없거나 실패하여 Cloudmersive API로 PDF 변환을 시도합니다.');
          const pdf = await convertViaCloudmersive(pptxBuffer);
          return { pdf, error: null };
        } catch (apiErr) {
          // eslint-disable-next-line no-console
          console.error('[git2ppt] Cloudmersive API 변환 실패:', apiErr);
          const errorMsg = apiErr instanceof Error ? apiErr.message : String(apiErr);
          return {
            pdf: null,
            error: `Vercel에서 PDF 변환을 위해 Cloudmersive API를 호출했으나 실패했습니다: ${errorMsg}`,
          };
        }
      }

      const failDesc = describePdfFailure(err);
      return { pdf: null, error: failDesc.error, pdfRetriable: failDesc.retriable };
    } finally {
      await fs.rm(tmp, { recursive: true, force: true }).catch(() => undefined);
    }
  } else {
    // If temp dir creation failed, try Cloudmersive directly as last resort
    const cloudmersiveKey = process.env.CLOUDMERSIVE_API_KEY?.trim();
    if (cloudmersiveKey) {
      try {
        const pdf = await convertViaCloudmersive(pptxBuffer);
        return { pdf, error: null };
      } catch (apiErr) {
        // eslint-disable-next-line no-console
        console.error('[git2ppt] Cloudmersive API 변환 실패:', apiErr);
        const errorMsg = apiErr instanceof Error ? apiErr.message : String(apiErr);
        const isAuthError = /401|403|unauthorized|forbidden|invalid api key/i.test(errorMsg);
        return {
          pdf: null,
          error: `임시 폴더 생성 실패 후 Cloudmersive API 변환을 시도했으나 실패했습니다: ${errorMsg}`,
          pdfRetriable: !isAuthError,
        };
      }
    }
    return { pdf: null, error: '임시 폴더를 생성할 수 없어 PDF 변환에 실패했습니다.', pdfRetriable: false };
  }
}
