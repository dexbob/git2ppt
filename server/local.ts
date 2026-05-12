import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
import type { RepositoryMetadata } from '../lib/types.js';
import { analyzeGithubRepository } from '../lib/analyzeRepo.js';
import { generateSpecWithOpenAI } from '../lib/generateSpec.js';
import { loadInstructionFromFile } from '../lib/instructionFile.js';
import { generateSlideDeckSpec } from '../lib/generateSlides.js';
import { buildPptxBuffer } from '../lib/buildPptx.js';
import { convertPptxBufferToPdf } from '../lib/pdfConvert.js';
import {
  base64ToBuffer,
  bundleToZipBuffer,
  bufferToBase64,
  type ExportBundle,
} from '../lib/exportZip.js';

const app = express();
const PORT = Number(process.env.PORT ?? 8787);

app.use(
  cors({
    origin: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
  }),
);
app.use(express.json({ limit: '32mb' }));

app.post('/api/analyze-repo', async (req, res) => {
  try {
    const url = req.body?.url as string | undefined;
    if (!url?.trim()) {
      res.status(400).json({ error: 'url이 필요합니다.' });
      return;
    }
    const metadata = await analyzeGithubRepository(url.trim());
    res.json({ metadata });
  } catch (err) {
    const message = err instanceof Error ? err.message : '저장소 분석에 실패했습니다.';
    res.status(500).json({ error: message });
  }
});

app.post('/api/generate-spec', async (req, res) => {
  try {
    const metadata = req.body?.metadata as RepositoryMetadata | undefined;
    if (!metadata) {
      res.status(400).json({ error: 'metadata가 필요합니다.' });
      return;
    }
    const instruction = await loadInstructionFromFile();
    const out = await generateSpecWithOpenAI(metadata, instruction);
    res.json(out);
  } catch (err) {
    const message = err instanceof Error ? err.message : '기술명세서 생성에 실패했습니다.';
    res.status(500).json({ error: message });
  }
});

app.post('/api/generate-slides', async (req, res) => {
  try {
    const techSpecMarkdown = req.body?.techSpecMarkdown as string | undefined;
    const repoUrl = req.body?.repoUrl as string | undefined;
    if (!techSpecMarkdown?.trim() || !repoUrl?.trim()) {
      res.status(400).json({ error: 'techSpecMarkdown와 repoUrl이 필요합니다.' });
      return;
    }
    const slideDeck = await generateSlideDeckSpec(techSpecMarkdown, repoUrl.trim());
    const pptxBuffer = await buildPptxBuffer(slideDeck);
    const { pdf: pdfBuffer, error: pdfError } = await convertPptxBufferToPdf(pptxBuffer);
    res.json({
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
});

app.post('/api/export-files', async (req, res) => {
  try {
    const readmeMarkdown = req.body?.readmeMarkdown as string | undefined;
    const techSpecMarkdown = req.body?.techSpecMarkdown as string | undefined;
    const pptxBase64 = req.body?.pptxBase64 as string | undefined;
    const pdfBase64 = req.body?.pdfBase64 as string | undefined | null;

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
    res.send(zip);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'ZIP 생성에 실패했습니다.';
    if (!res.headersSent) res.status(500).json({ error: message });
  }
});

if (process.env.SERVE_STATIC === '1') {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const dist = path.resolve(__dirname, '..', 'dist');
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(dist, 'index.html'));
  });
}

const server = app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[local] API http://127.0.0.1:${PORT}`);
});

server.requestTimeout = 0;
server.headersTimeout = 0;
server.timeout = Number(process.env.SERVER_TIMEOUT_MS ?? 600_000);
