import type { VercelRequest, VercelResponse } from '@vercel/node';
import { base64ToBuffer, bundleToZipBuffer, type ExportBundle } from '../lib/exportZip';

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
    const readmeMarkdown = body?.readmeMarkdown as string | undefined;
    const techSpecMarkdown = body?.techSpecMarkdown as string | undefined;
    const pptxBase64 = body?.pptxBase64 as string | undefined;
    const pdfBase64 = body?.pdfBase64 as string | undefined | null;

    if (!readmeMarkdown || !techSpecMarkdown || !pptxBase64) {
      res.status(400).json({ error: 'readmeMarkdown, techSpecMarkdown, pptxBase64가 필요합니다.' });
      return;
    }

    const bundle: ExportBundle = {
      readmeMarkdown,
      techSpecMarkdown,
      pptxBuffer: base64ToBuffer(pptxBase64),
      pdfBuffer: pdfBase64 ? base64ToBuffer(pdfBase64) : null,
    };

    const zip = await bundleToZipBuffer(bundle);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="presentation-bundle.zip"');
    res.status(200).send(zip);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'ZIP 생성에 실패했습니다.';
    if (!res.headersSent) {
      res.status(500).json({ error: message });
    }
  }
}
