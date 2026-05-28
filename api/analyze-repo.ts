import type { VercelRequest, VercelResponse } from '@vercel/node';
import { AnalyzeTimeoutError, analyzeGithubRepository } from '../lib/analyzeRepo.js';

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
    const url = body?.url as string | undefined;
    const timeoutMsRaw = body?.timeoutMs;
    const timeoutMs =
      typeof timeoutMsRaw === 'number' && Number.isFinite(timeoutMsRaw) ? timeoutMsRaw : undefined;
    if (!url?.trim()) {
      res.status(400).json({ error: 'url이 필요합니다.' });
      return;
    }
    const metadata = await analyzeGithubRepository(url.trim(), { cloneTimeoutMs: timeoutMs });
    res.status(200).json({ metadata });
  } catch (err) {
    if (err instanceof AnalyzeTimeoutError) {
      res.status(408).json({
        code: 'ANALYZE_TIMEOUT',
        timeoutMs: err.timeoutMs,
        error: err.message,
      });
      return;
    }
    const message = err instanceof Error ? err.message : '저장소 분석에 실패했습니다.';
    res.status(500).json({ error: message });
  }
}
