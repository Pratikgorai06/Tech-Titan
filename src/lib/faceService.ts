/**
 * faceService.ts — Browser-based face detection, recognition & liveness utilities.
 *
 * Uses face-api.js (TensorFlow.js) for:
 *   - SSD MobilenetV1 face detection
 *   - 68-point face landmarks (eyes, nose, mouth)
 *   - 128-dimensional face descriptor for recognition
 *
 * Models are loaded from a CDN and cached by the browser.
 */

import * as faceapi from 'face-api.js';

// ─── CDN for pre-trained models ───────────────────────────────────────────────

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';

let modelsLoaded = false;

// ─── Load Models ──────────────────────────────────────────────────────────────

export async function loadFaceModels(): Promise<void> {
  if (modelsLoaded) return;
  await Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ]);
  modelsLoaded = true;
}

export function areModelsLoaded(): boolean {
  return modelsLoaded;
}

// ─── Face Detection ───────────────────────────────────────────────────────────

export type FaceResult = {
  detection: faceapi.FaceDetection;
  landmarks: faceapi.FaceLandmarks68;
  descriptor: Float32Array;
};

/**
 * Detect a single face from a video element, returning landmarks + descriptor.
 * Returns null if no face found or face confidence is too low.
 */
export async function detectSingleFace(
  input: HTMLVideoElement | HTMLCanvasElement
): Promise<FaceResult | null> {
  const result = await faceapi
    .detectSingleFace(input, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!result) return null;
  return {
    detection: result.detection,
    landmarks: result.landmarks,
    descriptor: result.descriptor,
  };
}

/**
 * Compute just the 128D face descriptor from a video/canvas.
 */
export async function computeDescriptor(
  input: HTMLVideoElement | HTMLCanvasElement
): Promise<Float32Array | null> {
  const result = await detectSingleFace(input);
  return result?.descriptor ?? null;
}

// ─── Face Matching ────────────────────────────────────────────────────────────

/**
 * Euclidean distance between two 128D descriptors.
 */
function euclideanDistance(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] - b[i]) ** 2;
  }
  return Math.sqrt(sum);
}

/**
 * Compare a live descriptor against an array of stored descriptors.
 * Returns match=true if the best distance is ≤ threshold.
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

// ─── Liveness Detection Utilities ─────────────────────────────────────────────

/**
 * Eye Aspect Ratio (EAR) — measures how open an eye is.
 * When the eye is open, EAR ≈ 0.25–0.3. When closed, EAR ≈ 0.05–0.1.
 *
 * Uses the 6-point eye model from 68-point landmarks.
 */
function eyeAspectRatio(eyePoints: faceapi.Point[]): number {
  // Vertical distances
  const v1 = Math.hypot(eyePoints[1].x - eyePoints[5].x, eyePoints[1].y - eyePoints[5].y);
  const v2 = Math.hypot(eyePoints[2].x - eyePoints[4].x, eyePoints[2].y - eyePoints[4].y);
  // Horizontal distance
  const h = Math.hypot(eyePoints[0].x - eyePoints[3].x, eyePoints[0].y - eyePoints[3].y);
  return (v1 + v2) / (2 * h);
}

/**
 * Detect if the user is blinking (both eyes EAR below threshold).
 */
export function checkBlink(landmarks: faceapi.FaceLandmarks68): boolean {
  const positions = landmarks.positions;
  // Left eye: landmarks 36–41, Right eye: 42–47
  const leftEye = positions.slice(36, 42);
  const rightEye = positions.slice(42, 48);

  const leftEAR = eyeAspectRatio(leftEye);
  const rightEAR = eyeAspectRatio(rightEye);
  const avgEAR = (leftEAR + rightEAR) / 2;

  return avgEAR < 0.2; // Eyes are closed
}

/**
 * Detect if the user is smiling (mouth width-to-height ratio increases).
 */
export function checkSmile(landmarks: faceapi.FaceLandmarks68): boolean {
  const positions = landmarks.positions;
  // Mouth corners: 48 (left), 54 (right)
  // Upper lip top: 51, Lower lip bottom: 57
  const mouthWidth = Math.hypot(
    positions[54].x - positions[48].x,
    positions[54].y - positions[48].y
  );
  const mouthHeight = Math.hypot(
    positions[57].x - positions[51].x,
    positions[57].y - positions[51].y
  );

  // A smile makes the mouth wider relative to height
  const ratio = mouthWidth / (mouthHeight + 0.001);
  return ratio > 4.0; // Smiling threshold — wide mouth with less height
}

/**
 * Detect head turn direction by checking nose tip offset from face center.
 */
export function checkHeadTurn(
  landmarks: faceapi.FaceLandmarks68,
  direction: 'left' | 'right'
): boolean {
  const positions = landmarks.positions;
  // Nose tip: landmark 30
  // Face left edge: landmark 0, right edge: landmark 16
  const noseTip = positions[30];
  const leftEdge = positions[0];
  const rightEdge = positions[16];

  const faceWidth = rightEdge.x - leftEdge.x;
  const faceCenterX = (leftEdge.x + rightEdge.x) / 2;
  const noseOffset = (noseTip.x - faceCenterX) / faceWidth;

  // Positive offset = nose is to the right of center (head turned left, from user's perspective)
  // We need to account for the mirrored camera
  if (direction === 'left') {
    return noseOffset > 0.12; // Nose shifted right in camera = user turned head to their left
  } else {
    return noseOffset < -0.12; // Nose shifted left in camera = user turned head to their right
  }
}

// ─── Capture Frame ────────────────────────────────────────────────────────────

/**
 * Capture a frame from a video element as a base64 data URL (JPEG).
 */
export function captureFrame(video: HTMLVideoElement, quality = 0.85): string {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(video, 0, 0);
  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Capture a square face crop from a video element.
 */
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

  // Add some padding around the face
  const pad = box.width * 0.3;
  const sx = Math.max(0, box.x - pad);
  const sy = Math.max(0, box.y - pad);
  const sw = Math.min(video.videoWidth - sx, box.width + pad * 2);
  const sh = Math.min(video.videoHeight - sy, box.height + pad * 2);

  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, size, size);
  return canvas.toDataURL('image/jpeg', 0.8);
}

// ─── Device Fingerprint ───────────────────────────────────────────────────────

/**
 * Generate a simple device fingerprint from browser properties.
 * Not cryptographically secure — just a best-effort identifier.
 */
export function getDeviceFingerprint(): string {
  const raw = [
    navigator.userAgent,
    screen.width + 'x' + screen.height,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.language,
    navigator.hardwareConcurrency?.toString() || '',
  ].join('|');

  // Simple hash
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
