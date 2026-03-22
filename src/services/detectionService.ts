/**
 * YOLOv8 ONNX Runtime Web Detection Service
 *
 * Supports a custom pothole-specific YOLOv8 ONNX model.
 * Model config:
 *   • Set VITE_MODEL_URL in .env to point to your model (default: /best.onnx)
 *   • Export your YOLOv8 model: `yolo export model=best.pt format=onnx imgsz=640`
 *   • Place the exported best.onnx in the /public folder
 *
 * Output format: YOLOv8 default ONNX export  [1, 5+num_classes, 8400]
 * Classes expected: 0=pothole  (single-class model)
 *                   OR any multi-class model — 'pothole' class index set via VITE_POTHOLE_CLASS_INDEX
 */

import * as ort from 'onnxruntime-web';

// ── Model configuration ─────────────────────────────────────────────────────
// Default public pothole detection model (YOLOv8n fine-tuned on pothole dataset)
// Replace VITE_MODEL_URL in .env with '/best.onnx' if you have your own model.
const MODEL_URL =
  (import.meta.env.VITE_MODEL_URL as string | undefined) ||
  '/best.onnx';

// Index of the "pothole" class in your model. For a single-class model this is 0.
const POTHOLE_CLASS_IDX = parseInt(
  (import.meta.env.VITE_POTHOLE_CLASS_INDEX as string | undefined) || '0',
  10
);

const INPUT_SIZE = 640; // YOLOv8 default input resolution
const CONF_THRESHOLD = 0.40; // Minimum detection confidence
const IOU_THRESHOLD = 0.45;  // NMS IoU threshold

// ── Globals ──────────────────────────────────────────────────────────────────
let session: ort.InferenceSession | null = null;
let modelLoadFailed = false;
let modelLoadError = '';

// ── Public types ─────────────────────────────────────────────────────────────
export interface Detection {
  bbox: [number, number, number, number]; // [x, y, width, height] in VIDEO pixel coords
  class: string;
  score: number;
}

// ── Model loading ─────────────────────────────────────────────────────────────
export async function loadModel(): Promise<void> {
  if (session || modelLoadFailed) return;

  try {
    // Serve WASM + worker from public/ (ort-wasm-simd-threaded.wasm + .mjs committed to repo)
    // v1.24.3 only ships threaded variants — numThreads=1 uses 1 thread without SharedArrayBuffer
    ort.env.wasm.wasmPaths = '/';
    (ort.env.wasm as any).numThreads = 1;

    console.log(`[YOLO] Loading model from: ${MODEL_URL}`);
    session = await ort.InferenceSession.create(MODEL_URL, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    });
    console.log(`[YOLO] Model loaded. Inputs: ${session.inputNames}, Outputs: ${session.outputNames}`);
  } catch (err: any) {
    modelLoadFailed = true;
    modelLoadError = err?.message || String(err);
    console.error('[YOLO] Model load failed:', err);
    throw new Error(
      `YOLO model could not be loaded from "${MODEL_URL}".\n` +
      `Please export your YOLOv8 model to ONNX format and place it in the public/ folder:\n` +
      `  yolo export model=best.pt format=onnx imgsz=640\n` +
      `Then set VITE_MODEL_URL=/best.onnx in your .env file.\n\n` +
      `Original error: ${modelLoadError}`
    );
  }
}

export function isModelLoaded() { return !!session; }
export function getModelError() { return modelLoadError; }

// ── Preprocessing: letterbox resize to 640×640 ────────────────────────────────
function letterboxImage(
  source: HTMLVideoElement,
  targetSize: number
): { tensor: Float32Array; scaleX: number; scaleY: number; padX: number; padY: number } {
  const sw = source.videoWidth;
  const sh = source.videoHeight;

  const scale = Math.min(targetSize / sw, targetSize / sh);
  const newW = Math.round(sw * scale);
  const newH = Math.round(sh * scale);
  const padX = Math.floor((targetSize - newW) / 2);
  const padY = Math.floor((targetSize - newH) / 2);

  // Draw onto an off-screen canvas
  const canvas = document.createElement('canvas');
  canvas.width = targetSize;
  canvas.height = targetSize;
  const ctx = canvas.getContext('2d')!;

  // Black letterbox fill
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, targetSize, targetSize);
  ctx.drawImage(source, padX, padY, newW, newH);

  const imageData = ctx.getImageData(0, 0, targetSize, targetSize);
  const pixels = imageData.data;

  // CHW float32 tensor, normalized 0-1
  const tensor = new Float32Array(3 * targetSize * targetSize);
  const stride = targetSize * targetSize;
  for (let i = 0; i < stride; i++) {
    tensor[i]            = pixels[i * 4]     / 255; // R
    tensor[stride + i]   = pixels[i * 4 + 1] / 255; // G
    tensor[2 * stride + i] = pixels[i * 4 + 2] / 255; // B
  }

  return { tensor, scaleX: scale, scaleY: scale, padX, padY };
}

// ── NMS (IoU based) ───────────────────────────────────────────────────────────
function iou(a: number[], b: number[]) {
  // a, b: [x1, y1, x2, y2]
  const ix1 = Math.max(a[0], b[0]);
  const iy1 = Math.max(a[1], b[1]);
  const ix2 = Math.min(a[2], b[2]);
  const iy2 = Math.min(a[3], b[3]);
  const inter = Math.max(0, ix2 - ix1) * Math.max(0, iy2 - iy1);
  const aArea = (a[2] - a[0]) * (a[3] - a[1]);
  const bArea = (b[2] - b[0]) * (b[3] - b[1]);
  return inter / (aArea + bArea - inter + 1e-6);
}

function nms(boxes: number[][], scores: number[], iouThresh: number): number[] {
  const order = scores.map((_, i) => i).sort((a, b) => scores[b] - scores[a]);
  const keep: number[] = [];
  const suppressed = new Set<number>();
  for (const i of order) {
    if (suppressed.has(i)) continue;
    keep.push(i);
    for (const j of order) {
      if (i !== j && !suppressed.has(j) && iou(boxes[i], boxes[j]) > iouThresh) {
        suppressed.add(j);
      }
    }
  }
  return keep;
}

// ── Smooth detection positions between frames ─────────────────────────────────
const smoothed = new Map<number, Detection>();
const ALPHA = 0.4;

function lerpVal(a: number, b: number) { return a + (b - a) * ALPHA; }

// ── Main inference function ───────────────────────────────────────────────────
export async function detectPotholes(video: HTMLVideoElement): Promise<Detection[]> {
  if (!session) return [];
  if (video.readyState < 2 || video.videoWidth === 0) return [];

  const sw = video.videoWidth;
  const sh = video.videoHeight;

  // ── Preprocess ──
  const { tensor, scaleX, padX, padY } = letterboxImage(video, INPUT_SIZE);
  const inputTensor = new ort.Tensor('float32', tensor, [1, 3, INPUT_SIZE, INPUT_SIZE]);

  // ── Inference ──
  const feeds: Record<string, ort.Tensor> = {};
  feeds[session.inputNames[0]] = inputTensor;

  let outputData: Float32Array;
  let numDetections: number;
  let numClasses: number;

  try {
    const results = await session.run(feeds);
    const output = results[session.outputNames[0]];
    outputData = output.data as Float32Array;

    // YOLOv8 output shape: [1, 4+numClasses, 8400]
    // Transposed vs YOLOv5: each column is a candidate box
    const dims = output.dims; // [1, num_params, num_anchors]
    numDetections = dims[2];  // 8400 anchor candidates
    numClasses = dims[1] - 4; // subtract 4 bbox params
  } catch (err) {
    console.error('[YOLO] Inference error:', err);
    return [];
  }

  // ── Decode & filter ──
  const rawBoxes: number[][] = [];
  const rawScores: number[] = [];

  for (let i = 0; i < numDetections; i++) {
    // YOLOv8 default ONNX export layout: [cx, cy, w, h, cls0, cls1, ...]
    const cx = outputData[0 * numDetections + i];
    const cy = outputData[1 * numDetections + i];
    const w  = outputData[2 * numDetections + i];
    const h  = outputData[3 * numDetections + i];

    // Get class score for pothole class
    let maxScore = 0;
    let maxClass = -1;

    if (numClasses === 1) {
      // Single-class model: directly use class 0
      maxScore = outputData[4 * numDetections + i];
      maxClass = 0;
    } else {
      // Multi-class: find best class
      for (let c = 0; c < numClasses; c++) {
        const s = outputData[(4 + c) * numDetections + i];
        if (s > maxScore) { maxScore = s; maxClass = c; }
      }
    }

    // Only keep pothole class above threshold
    if (maxScore < CONF_THRESHOLD || maxClass !== POTHOLE_CLASS_IDX) continue;

    // Convert from letterbox space to video pixel space
    const x1Pad = cx - w / 2;
    const y1Pad = cy - h / 2;
    const x2Pad = cx + w / 2;
    const y2Pad = cy + h / 2;

    // Remove padding and unscale
    const x1 = (x1Pad - padX) / scaleX;
    const y1 = (y1Pad - padY) / scaleX;
    const x2 = (x2Pad - padX) / scaleX;
    const y2 = (y2Pad - padY) / scaleX;

    // Clip to video bounds
    const bx = Math.max(0, x1);
    const by = Math.max(0, y1);
    const bx2 = Math.min(sw, x2);
    const by2 = Math.min(sh, y2);

    rawBoxes.push([bx, by, bx2, by2]);
    rawScores.push(maxScore);
  }

  if (rawBoxes.length === 0) {
    smoothed.clear();
    return [];
  }

  // ── NMS ──
  const kept = nms(rawBoxes, rawScores, IOU_THRESHOLD);

  // ── Convert to Detection[] with temporal smoothing ──
  const results: Detection[] = kept.map((idx, slotIdx) => {
    const [bx, by, bx2, by2] = rawBoxes[idx];
    const bw = bx2 - bx;
    const bh = by2 - by;

    const prev = smoothed.get(slotIdx);
    let finalBox: [number, number, number, number];
    if (prev) {
      finalBox = [
        lerpVal(prev.bbox[0], bx),
        lerpVal(prev.bbox[1], by),
        lerpVal(prev.bbox[2], bw),
        lerpVal(prev.bbox[3], bh),
      ];
    } else {
      finalBox = [bx, by, bw, bh];
    }

    const det: Detection = { bbox: finalBox, class: 'pothole', score: rawScores[idx] };
    smoothed.set(slotIdx, det);
    return det;
  });

  // Clean up stale smoothing slots
  for (const k of smoothed.keys()) {
    if (k >= results.length) smoothed.delete(k);
  }

  return results;
}
