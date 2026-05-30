import type { VercelRequest, VercelResponse } from '@vercel/node';
import { analyzeGithubRepository } from '../lib/analyzeRepo.js';

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
    if (!url?.trim()) {
      res.status(400).json({ error: 'url이 필요합니다.' });
      return;
    }
    const metadata = await analyzeGithubRepository(url.trim());
    res.status(200).json({ metadata });
  } catch (err) {
    const message = err instanceof Error ? err.message : '저장소 분석에 실패했습니다.';
    res.status(500).json({ error: message });
  }
}
