import type { VercelRequest, VercelResponse } from '@vercel/node';
import { formatUserFacingError } from '../lib/formatUserFacingError.js';
import { translateReadmeToKorean } from '../lib/translateReadme.js';

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
    const sourceMarkdown = body?.sourceMarkdown as string | undefined;
    if (!sourceMarkdown?.trim()) {
      res.status(400).json({ error: 'sourceMarkdown가 필요합니다.' });
      return;
    }
    const readmeMarkdown = await translateReadmeToKorean(sourceMarkdown);
    res.status(200).json({ readmeMarkdown });
  } catch (err) {
    const message = formatUserFacingError(err, 'README 번역에 실패했습니다.');
    res.status(500).json({ error: message });
  }
}
