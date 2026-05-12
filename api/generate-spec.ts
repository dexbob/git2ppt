import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { RepositoryMetadata } from '../lib/types.js';
import { generateSpecWithOpenAI } from '../lib/generateSpec.js';
import { loadInstructionFromFile } from '../lib/instructionFile.js';

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
    const metadata = body?.metadata as RepositoryMetadata | undefined;
    if (!metadata) {
      res.status(400).json({ error: 'metadata가 필요합니다.' });
      return;
    }
    const instruction = await loadInstructionFromFile();
    const { techSpecMarkdown, readmeMarkdown } = await generateSpecWithOpenAI(
      metadata,
      instruction,
    );
    res.status(200).json({ techSpecMarkdown, readmeMarkdown });
  } catch (err) {
    const message = err instanceof Error ? err.message : '기술명세서 생성에 실패했습니다.';
    res.status(500).json({ error: message });
  }
}
