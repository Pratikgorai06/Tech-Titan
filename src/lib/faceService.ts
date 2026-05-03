/**
 * faceService.ts — Browser-based face detection & recognition.
 *
 * Uses face-api.js (TensorFlow.js) for:
 *   - SSD MobilenetV1 face detection (Accurate)
 *   - 68-point face landmarks
 *   - 128-dimensional face descriptor for recognition
 */

import * as faceapi from 'face-api.js';

// ─── CDN for pre-trained models ───────────────────────────────────────────────

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';

let modelsLoaded = false;
let modelsLoading: Promise<void> | null = null;

// ─── Load Models (Accurate Models) ────────────────────────────────────────────

export async function loadFaceModels(): Promise<void> {
  if (modelsLoaded) return;
  if (modelsLoading) return modelsLoading;

  modelsLoading = (async () => {
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
    modelsLoaded = true;
  })();

  return modelsLoading;
}

export function areModelsLoaded(): boolean {
  return modelsLoaded;
}

// ─── Face Detection ───────────────────────────────────────────────────────────

export type FaceResult = {
  detection: faceapi.FaceDetection;
  descriptor: Float32Array;
};

/**
 * Detect a single face from a video/canvas/image element.
 * Uses SsdMobilenetv1 for higher accuracy descriptor extraction.
 */
export async function detectSingleFace(
  input: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement
): Promise<FaceResult | null> {
  const result = await faceapi
    .detectSingleFace(input, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!result) return null;
  return {
    detection: result.detection,
    descriptor: result.descriptor,
  };
}

// ─── Face Matching ────────────────────────────────────────────────────────────

function euclideanDistance(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] - b[i]) ** 2;
  }
  return Math.sqrt(sum);
}

export function matchDescriptors(
  stored: number[][],
  live: Float32Array,
  threshold = 0.6
): { match: boolean; distance: number } {
  if (!stored.length) return { match: false, distance: Infinity };

  let bestDist = Infinity;
  for (const desc of stored) {
    const storedArr = new Float32Array(desc);
    const d = euclideanDistance(storedArr, live);
    if (d < bestDist) bestDist = d;
  }
  return { match: bestDist <= threshold, distance: bestDist };
}

// ─── Capture Utilities ────────────────────────────────────────────────────────

export function captureFrame(video: HTMLVideoElement, quality = 0.85): string {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(video, 0, 0);
  return canvas.toDataURL('image/jpeg', quality);
}

export function captureFaceCrop(
  video: HTMLVideoElement,
  detection: faceapi.FaceDetection,
  size = 200
): string {
  const box = detection.box;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const pad = box.width * 0.3;
  const sx = Math.max(0, box.x - pad);
  const sy = Math.max(0, box.y - pad);
  const sw = Math.min(video.videoWidth - sx, box.width + pad * 2);
  const sh = Math.min(video.videoHeight - sy, box.height + pad * 2);

  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, size, size);
  return canvas.toDataURL('image/jpeg', 0.85);
}

// ─── Device Fingerprint ───────────────────────────────────────────────────────

export function getDeviceFingerprint(): string {
  const raw = [
    navigator.userAgent,
    screen.width + 'x' + screen.height,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.language,
    navigator.hardwareConcurrency?.toString() || '',
  ].join('|');
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash) + raw.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
