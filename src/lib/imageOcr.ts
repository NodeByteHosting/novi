import { createWorker, Worker } from 'tesseract.js';
import { logger } from './logger';

const IMAGE_CONTENT_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/bmp'];
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB - skip huge images to keep OCR fast
const OCR_TIMEOUT_MS = 10_000;

let workerPromise: Promise<Worker> | null = null;

function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker('eng').catch(err => {
      workerPromise = null;
      throw err;
    });
  }
  return workerPromise;
}

export function isOcrEligibleAttachment(attachment: { contentType?: string | null; size: number }): boolean {
  if (!attachment.contentType || !IMAGE_CONTENT_TYPES.includes(attachment.contentType)) {
    return false;
  }
  return attachment.size <= MAX_IMAGE_BYTES;
}

/**
 * Extract text from an image URL using OCR. Returns an empty string on any
 * failure (unreadable image, timeout, worker error) so callers can treat
 * OCR as best-effort rather than fatal.
 */
export async function extractTextFromImage(url: string): Promise<string> {
  try {
    const worker = await getWorker();
    const result = await Promise.race([
      worker.recognize(url),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('OCR timeout')), OCR_TIMEOUT_MS)),
    ]);
    return result.data.text || '';
  } catch (err) {
    logger.debug('OCR extraction failed', { context: 'ImageOcr', url, error: err });
    return '';
  }
}

export async function shutdownOcr(): Promise<void> {
  if (workerPromise) {
    try {
      const worker = await workerPromise;
      await worker.terminate();
    } catch {
      // ignore
    } finally {
      workerPromise = null;
    }
  }
}
