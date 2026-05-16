import archiver from 'archiver';
import type { Archiver } from 'archiver';
import { Writable } from 'node:stream';

export type ExportBundle = {
  readmeMarkdown: string;
  techSpecMarkdown: string;
  pptxBuffer: Buffer;
  pdfBuffer: Buffer | null;
};

/** Append standard export filenames to an archiver instance (caller must pipe and finalize). */
export function appendBundleToArchive(archive: Archiver, bundle: ExportBundle): void {
  archive.append(bundle.readmeMarkdown, { name: 'README.md' });
  archive.append(bundle.techSpecMarkdown, { name: 'tech_spec.md' });
  archive.append(bundle.pptxBuffer, { name: 'slides.pptx' });
  if (bundle.pdfBuffer) {
    archive.append(bundle.pdfBuffer, { name: 'slides.pdf' });
  }
}

export async function bundleToZipBuffer(bundle: ExportBundle): Promise<Buffer> {
  const archive = archiver('zip', { zlib: { level: 9 } });
  const chunks: Buffer[] = [];
  const sink = new Writable({
    write(chunk, _enc, cb) {
      chunks.push(chunk as Buffer);
      cb();
    },
  });
  const finished = new Promise<void>((resolve, reject) => {
    sink.on('finish', () => resolve());
    sink.on('error', reject);
    archive.on('error', reject);
  });
  archive.pipe(sink);
  appendBundleToArchive(archive, bundle);
  await archive.finalize();
  await finished;
  return Buffer.concat(chunks);
}

export function bufferToBase64(buf: Buffer): string {
  return buf.toString('base64');
}

export function base64ToBuffer(b64: string): Buffer {
  return Buffer.from(b64, 'base64');
}
