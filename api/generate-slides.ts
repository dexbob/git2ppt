import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateSlideDeckSpec } from '../lib/generateSlides.js';
import { buildPptxBuffer } from '../lib/buildPptx.js';
import { convertPptxBufferToPdf } from '../lib/pdfConvert.js';
import { bufferToBase64 } from '../lib/exportZip.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const techSpecMarkdown = body?.techSpecMarkdown as string | undefined;
    const repoUrl = body?.repoUrl as string | undefined;
    if (!techSpecMarkdown?.trim() || !repoUrl?.trim()) {
      res.status(400).json({ error: 'techSpecMarkdown와 repoUrl이 필요합니다.' });
      return;
    }

    const slideDeck = await generateSlideDeckSpec(techSpecMarkdown, repoUrl.trim());
    const pptxBuffer = await buildPptxBuffer(slideDeck);

    const skipPdf =
      process.env.SKIP_PDF === '1' || (process.env.VERCEL === '1' && process.env.ENABLE_PDF_ON_VERCEL !== '1');
    let pdfBuffer: Buffer | null = null;
    let pdfError: string | null = null;
    if (!skipPdf) {
      const conv = await convertPptxBufferToPdf(pptxBuffer);
      pdfBuffer = conv.pdf;
      pdfError = conv.error;
    }

    res.status(200).json({
      slideDeck,
      pptxBase64: bufferToBase64(pptxBuffer),
      pdfBase64: pdfBuffer ? bufferToBase64(pdfBuffer) : null,
      pdfAvailable: Boolean(pdfBuffer),
      pdfError,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '슬라이드 생성에 실패했습니다.';
    res.status(500).json({ error: message });
  }
}
