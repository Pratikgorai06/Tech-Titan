/**
 * faceService.ts — Simplified face detection & recognition.
 *
 * Uses face-api.js with TinyFaceDetector (fast, lightweight) instead of SSD MobilenetV1.
 * Models loaded from a public CDN and cached by the browser.
 */

import * as faceapi from 'face-api.js';

// ─── CDN for pre-trained models ───────────────────────────────────────────────
// Using the official face-api.js weights hosted on jsdelivr
const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights';

let modelsLoaded = false;
let modelsLoading: Promise<void> | null = null;

// ─── Load Models (singleton, fast TinyFaceDetector) ───────────────────────────

export async function loadFaceModels(): Promise<void> {
  if (modelsLoaded) return;
  if (modelsLoading) return modelsLoading;

  modelsLoading = (async () => {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
    modelsLoaded = true;
  })();

  return modelsLoading;
}

export function areModelsLoaded(): boolean {
  return modelsLoaded;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type FaceResult = {
  detection: faceapi.FaceDetection;
  descriptor: Float32Array;
};

// ─── Detect Face (single-shot, not real-time) ─────────────────────────────────

/**
 * Detect a single face from a video/canvas/image element.
 * Uses TinyFaceDetector for speed.
 */
export async function detectSingleFace(
  input: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement
): Promise<FaceResult | null> {
  const result = await faceapi
    .detectSingleFace(input, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.4 }))
    .withFaceLandmarks(true) // tiny landmarks
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

/**
 * Compare a live descriptor against stored descriptors.
 * Returns match=true if best distance ≤ threshold.
 */
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

/** Capture a full frame from video as base64 JPEG. */
export function captureFrame(video: HTMLVideoElement, quality = 0.8): string {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(video, 0, 0);
  return canvas.toDataURL('image/jpeg', quality);
}

/** Capture a square face crop from video. */
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
  return canvas.toDataURL('image/jpeg', 0.8);
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
