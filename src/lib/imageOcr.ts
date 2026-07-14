import { createWorker, Worker, PSM } from 'tesseract.js';
import sharp from 'sharp';
import { logger } from './logger';

const IMAGE_CONTENT_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/bmp'];
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB - skip huge images to keep OCR fast
const PASS_TIMEOUT_MS = 10_000;
const MIN_USABLE_ALPHA_CHARS = 30; // below this, the whole-image pass is treated as unreliable

let workerPromise: Promise<Worker> | null = null;

function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker('eng')
      .then(async worker => {
        // Scam collages are typically fragmented multi-panel screenshots, not a
        // single uniform text block - SPARSE_TEXT copes with that much better
        // than the default page-segmentation mode.
        await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
        return worker;
      })
      .catch(err => {
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

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch (err) {
    logger.debug('Failed to fetch image for OCR', { context: 'ImageOcr', url, error: err });
    return null;
  }
}

/** Upscales small/compressed screenshots and boosts contrast - both meaningfully improve OCR accuracy on small UI text. */
async function preprocess(buffer: Buffer): Promise<Buffer> {
  const image = sharp(buffer);
  const metadata = await image.metadata();
  const width = metadata.width || 1000;
  const scale = width < 1600 ? 2 : 1;

  return image
    .resize({ width: Math.round(width * scale), kernel: 'lanczos3' })
    .grayscale()
    .normalize()
    .sharpen()
    .toBuffer();
}

/** Splits the image into 4 overlapping quadrants, upscales/preprocesses each, and OCRs them individually. */
async function ocrByQuadrant(worker: Worker, buffer: Buffer): Promise<string> {
  const metadata = await sharp(buffer).metadata();
  const width = metadata.width || 0;
  const height = metadata.height || 0;
  if (width < 2 || height < 2) return '';

  // 55% width/height per quadrant gives ~10% overlap so text isn't cleanly cut at the boundary
  const halfW = Math.round(width * 0.55);
  const halfH = Math.round(height * 0.55);
  const regions = [
    { left: 0, top: 0 },
    { left: width - halfW, top: 0 },
    { left: 0, top: height - halfH },
    { left: width - halfW, top: height - halfH },
  ];

  const texts: string[] = [];
  for (const region of regions) {
    try {
      const cropped = await sharp(buffer)
        .extract({ left: region.left, top: region.top, width: halfW, height: halfH })
        .toBuffer();
      const preprocessed = await preprocess(cropped);
      const text = await runOcrPass(worker, preprocessed);
      if (text) texts.push(text);
    } catch (err) {
      logger.debug('Quadrant OCR pass failed', { context: 'ImageOcr', error: err });
    }
  }

  return texts.join(' ');
}

function countAlphaChars(text: string): number {
  return (text.match(/[a-zA-Z]/g) || []).length;
}

async function runOcrPass(worker: Worker, input: Buffer | string): Promise<string> {
  const result = await Promise.race([
    worker.recognize(input),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('OCR timeout')), PASS_TIMEOUT_MS)),
  ]);
  return result.data.text || '';
}

/**
 * Extract text from an image URL using OCR. Returns an empty string on any
 * failure (unreadable image, timeout, worker error) so callers can treat
 * OCR as best-effort rather than fatal.
 *
 * Multi-panel scam collages (e.g. fake giveaway screenshots stitched into a
 * 2x2 grid) tend to OCR poorly as a single pass, so when the initial pass
 * yields little usable text, we retry by splitting the image into quadrants.
 */
export async function extractTextFromImage(url: string): Promise<string> {
  try {
    const worker = await getWorker();
    const original = await fetchImageBuffer(url);
    if (!original) return '';

    const preprocessed = await preprocess(original).catch(() => original);
    let text = await runOcrPass(worker, preprocessed);

    if (countAlphaChars(text) < MIN_USABLE_ALPHA_CHARS) {
      const quadrantText = await ocrByQuadrant(worker, original);
      if (countAlphaChars(quadrantText) > countAlphaChars(text)) {
        text = quadrantText;
      }
    }

    return text;
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
