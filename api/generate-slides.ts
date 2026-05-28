import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateSlideDeckSpec } from '../lib/generateSlides.js';
import { buildPptxBuffer } from '../lib/buildPptx.js';
import {
  cleanupDynamicCoverPath,
  resolveCoverBackgroundPath,
  secondaryTemplateCoverPath,
} from '../lib/coverBackground.js';
import { coverTagsFromSignals } from '../lib/coverTags.js';
import type { DetectedSignals } from '../lib/types.js';
import { convertPptxBufferToPdf } from '../lib/pdfConvert.js';
import { bufferToBase64 } from '../lib/exportZip.js';
import { buildPdfSkippedNote } from '../lib/pdfStatusNote.js';
import { formatUserFacingError } from '../lib/formatUserFacingError.js';

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
    const readmeMarkdown = body?.readmeMarkdown as string | undefined;
    const ownerDisplayName = body?.ownerDisplayName as string | null | undefined;
    const detected = body?.detected as DetectedSignals | undefined;
    const githubTopics = body?.githubTopics as string[] | undefined;
    if (!techSpecMarkdown?.trim() || !repoUrl?.trim()) {
      res.status(400).json({ error: 'techSpecMarkdown와 repoUrl이 필요합니다.' });
      return;
    }

    const slideDeck = await generateSlideDeckSpec(
      techSpecMarkdown,
      repoUrl.trim(),
      readmeMarkdown,
    );
    const coverTags =
      detected != null
        ? coverTagsFromSignals(detected, Array.isArray(githubTopics) ? githubTopics : [])
        : [];
    const coverSlide = slideDeck.slides.find((s) => s.type === 'cover');
    const coverBg = await resolveCoverBackgroundPath({
      repoUrl: repoUrl.trim(),
      projectName: coverSlide?.type === 'cover' ? coverSlide.projectName : undefined,
      detected,
      githubTopics: Array.isArray(githubTopics) ? githubTopics : [],
    });
    const coverBgAltPath = secondaryTemplateCoverPath(coverBg.category);
    let pptxBuffer: Buffer;
    try {
      pptxBuffer = await buildPptxBuffer(slideDeck, {
        ownerDisplayName: ownerDisplayName ?? null,
        coverTags,
        coverBackgroundPath: coverBg.path,
        coverBackgroundAltPath: coverBgAltPath,
      });
    } finally {
      await cleanupDynamicCoverPath(coverBg);
    }

    const skipPdf =
      process.env.SKIP_PDF === '1' || (process.env.VERCEL === '1' && process.env.ENABLE_PDF_ON_VERCEL !== '1');
    let pdfBuffer: Buffer | null = null;
    let pdfError: string | null = null;
    let pdfNote: string | null = null;
    if (!skipPdf) {
      const conv = await convertPptxBufferToPdf(pptxBuffer);
      pdfBuffer = conv.pdf;
      pdfError = conv.error;
    } else {
      const note = buildPdfSkippedNote();
      pdfNote = note || null;
    }

    res.status(200).json({
      slideDeck,
      pptxBase64: bufferToBase64(pptxBuffer),
      pdfBase64: pdfBuffer ? bufferToBase64(pdfBuffer) : null,
      pdfAvailable: Boolean(pdfBuffer),
      pdfError,
      pdfNote,
    });
  } catch (err) {
    const message = formatUserFacingError(err, '슬라이드 생성에 실패했습니다.');
    res.status(500).json({ error: message });
  }
}
