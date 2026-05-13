import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_REL = path.join('reference', 'instruction.md');

/**
 * Loads optional tech-spec instructions from disk.
 * Path: `INSTRUCTION_FILE` env (absolute or relative to `process.cwd()`), else `reference/instruction.md`.
 * Missing file or empty content → `undefined`.
 */
export async function loadInstructionFromFile(): Promise<string | undefined> {
  const raw = process.env.INSTRUCTION_FILE?.trim();
  const filePath = raw
    ? path.isAbsolute(raw)
      ? raw
      : path.resolve(process.cwd(), raw)
    : path.resolve(process.cwd(), DEFAULT_REL);
  try {
    const text = await fs.readFile(filePath, 'utf8');
    const trimmed = text.trim();
    return trimmed || undefined;
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return undefined;
    throw e;
  }
}
